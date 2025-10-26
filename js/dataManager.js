// dataManager.js
class DataManager {
    constructor() {
        this.movies = [];
        // DON'T call loadMovies() here if it's also called in app.js
        // this.loadMovies(); // Remove this line if it exists
    }
    
    loadMovies() {
        try {
            const stored = localStorage.getItem(CONFIG.STORAGE.MOVIES_KEY);
            this.movies = stored ? JSON.parse(stored) : [];
            console.log('DataManager: Loaded', this.movies.length, 'movies from storage');
            console.log('Movie IDs:', this.movies.map(m => m.id));
            return this.movies;
        } catch (error) {
            console.error('Error loading movies:', error);
            this.movies = [];
            return this.movies;
        }
    }

    saveMovies() {
        try {
            localStorage.setItem(CONFIG.STORAGE.MOVIES_KEY, JSON.stringify(this.movies));
            // Safe eventBus check - don't crash if not available yet
            if (typeof eventBus !== 'undefined' && eventBus.emit) {
                eventBus.emit('movies:updated', this.movies);
            }
        } catch (error) {
            console.error('Error saving movies:', error);
        }
    }

    addMovie(movieData) {
        if (!this.validateMovie(movieData)) {
            throw new Error('Invalid movie data');
        }

        // DEBUG: Check what data we're receiving for TV shows
        if (movieData.type === 'tv') {
            console.log('=== ADDING TV SHOW DEBUG ===');
            console.log('movieData:', movieData);
            console.log('tmdb_data:', movieData.tmdb_data);
            console.log('seasons_data:', movieData.tmdb_data?.seasons_data);
            console.log('totalSeasons:', movieData.totalSeasons);
            console.log('totalEpisodes:', movieData.totalEpisodes);
        }

        const newMovie = {
            id: Date.now(),
            ...movieData,
            addedDate: new Date().toLocaleDateString(),
            watched: false,
            watchedEpisodes: movieData.type === 'tv' ? this.initializeEpisodes(movieData) : [],
            userRating: 0,
            userReview: '',
            year: movieData.year || this.extractYearFromTitle(movieData.title),
            lastUpdated: Date.now()
        };
        
        // DEBUG: Check what episodes were created
        if (movieData.type === 'tv') {
            console.log('Created episodes:', newMovie.watchedEpisodes);
            console.log('=== END TV SHOW DEBUG ===');
        }
        
        this.movies.push(newMovie);
        const success = this.saveMovies();
        
        if (success) {
            eventBus.emit('movie:added', { movie: newMovie, source: movieData.tmdb_id ? 'tmdb' : 'manual' });
        }
        
        return newMovie;
    }

    validateMovie(movie) {
        const required = ['title', 'type'];
        const hasRequired = required.every(field => movie[field]);
        
        if (!hasRequired) {
            return false;
        }

        // Validate type
        if (!['movie', 'tv'].includes(movie.type)) {
            return false;
        }

        return true;
    }

    extractYearFromTitle(title) {
        const yearMatch = title.match(/\((\d{4})\)/);
        return yearMatch ? parseInt(yearMatch[1]) : 0;
    }

    // In dataManager.js - FIXED initializeEpisodes method
    initializeEpisodes(tvShow) {
        const episodes = [];
        
        console.log('Initializing episodes for:', tvShow.title);
        console.log('TMDB data available:', !!tvShow.tmdb_data);
        console.log('Seasons data:', tvShow.tmdb_data?.seasons_data);
        
        // Use TMDB season data if available - FIXED VERSION
        if (tvShow.tmdb_data?.seasons_data && tvShow.tmdb_data.seasons_data.length > 0) {
            console.log('Using TMDB seasons data');
            
            tvShow.tmdb_data.seasons_data.forEach(seasonData => {
                // Skip season 0 (specials) and ensure season_number exists
                if (seasonData.season_number === 0) return;
                
                // TRY DIFFERENT PROPERTY NAMES for episode count
                const episodeCount = seasonData.episode_count || 
                                seasonData.episodes?.length || 
                                (seasonData.episodes ? seasonData.episodes.length : 0) ||
                                0;
                
                console.log(`Season ${seasonData.season_number}:`, {
                    episode_count: seasonData.episode_count,
                    episodes_length: seasonData.episodes?.length,
                    seasonData: seasonData
                });
                
                // If we have episodes array, use its length
                if (seasonData.episodes && Array.isArray(seasonData.episodes)) {
                    console.log(`Using episodes array for season ${seasonData.season_number}: ${seasonData.episodes.length} episodes`);
                    seasonData.episodes.forEach(episode => {
                        episodes.push({
                            season: seasonData.season_number,
                            episode: episode.episode_number,
                            watched: false,
                            episodeId: `${seasonData.season_number}-${episode.episode_number}`
                        });
                    });
                }
                // Otherwise use episode_count or fallback
                else if (episodeCount > 0) {
                    console.log(`Creating ${episodeCount} episodes for season ${seasonData.season_number}`);
                    for (let episode = 1; episode <= episodeCount; episode++) {
                        episodes.push({
                            season: seasonData.season_number,
                            episode: episode,
                            watched: false,
                            episodeId: `${seasonData.season_number}-${episode}`
                        });
                    }
                }
                // Last resort: use the total_episodes from the main show data
                else if (tvShow.tmdb_data?.total_episodes) {
                    console.log('Using total_episodes fallback');
                    const seasons = tvShow.tmdb_data.total_seasons || 1;
                    const totalEpisodes = tvShow.tmdb_data.total_episodes;
                    const episodesPerSeason = Math.ceil(totalEpisodes / seasons);
                    
                    for (let season = 1; season <= seasons; season++) {
                        const episodesThisSeason = (season === seasons) ? 
                            totalEpisodes - (episodesPerSeason * (seasons - 1)) : 
                            episodesPerSeason;
                        for (let episode = 1; episode <= episodesThisSeason; episode++) {
                            episodes.push({
                                season: season,
                                episode: episode,
                                watched: false,
                                episodeId: `${season}-${episode}`
                            });
                        }
                    }
                }
            });
        } 
        // Fallback with better defaults
        else {
            console.log('Using fallback episode initialization');
            const seasons = Math.max(tvShow.totalSeasons || 1, 1);
            const totalEpisodes = Math.max(tvShow.totalEpisodes || seasons * 10, 10);
            
            const episodesPerSeason = Math.ceil(totalEpisodes / seasons);
            
            for (let season = 1; season <= seasons; season++) {
                const episodesThisSeason = (season === seasons) ? 
                    totalEpisodes - (episodesPerSeason * (seasons - 1)) : 
                    episodesPerSeason;
                    
                for (let episode = 1; episode <= episodesThisSeason; episode++) {
                    episodes.push({
                        season: season,
                        episode: episode,
                        watched: false,
                        episodeId: `${season}-${episode}`
                    });
                }
            }
        }
        
        console.log(`Created ${episodes.length} episodes total`);
        return episodes;
    }

    getMovieById(id) {
        const numericId = Number(id);
        return this.movies.find(movie => movie.id === numericId);
    }

    updateMovie(id, updates) {
        const movie = this.getMovieById(id);
        if (movie) {
            Object.assign(movie, updates, { lastUpdated: Date.now() });
            this.saveMovies();
            eventBus.emit('movie:updated', { movie, updates });
        }
        return movie;
    }

    batchUpdate(updates) {
        const results = [];
        updates.forEach(({ id, updates }) => {
            const result = this.updateMovie(id, updates);
            if (result) results.push(result);
        });
        return results;
    }

    deleteMovie(id) {
        const movie = this.getMovieById(id);
        this.movies = this.movies.filter(m => m.id !== id);
        const success = this.saveMovies();
        
        if (success && movie) {
            eventBus.emit('movie:deleted', { movie });
        }
        
        return movie;
    }

    toggleWatched(id) {
        const movie = this.getMovieById(id);
        if (movie) {
            // For TV shows, only mark as watched if ALL episodes are watched
            if (movie.type === 'tv') {
                const allEpisodesWatched = movie.watchedEpisodes && 
                                        movie.watchedEpisodes.every(ep => ep.watched);
                
                // Only toggle if all episodes are watched, or we're marking as unwatched
                if (allEpisodesWatched || !movie.watched) {
                    movie.watched = !movie.watched;
                    movie.lastUpdated = Date.now();
                    
                    // If marking as unwatched, remove rating and review
                    if (!movie.watched && (movie.userRating || movie.userReview)) {
                        movie.userRating = 0;
                        movie.userReview = '';
                    }
                } else {
                    // If not all episodes are watched, don't mark as watched
                    // Just save the current state
                    console.log('Not all episodes watched - show remains unwatched');
                }
            } else {
                // For movies, normal toggle behavior
                movie.watched = !movie.watched;
                movie.lastUpdated = Date.now();
                
                // If marking as unwatched, remove rating and review
                if (!movie.watched && (movie.userRating || movie.userReview)) {
                    movie.userRating = 0;
                    movie.userReview = '';
                }
            }
            
            this.saveMovies();
            eventBus.emit('movie:watchedToggled', { movie, wasWatched: !movie.watched });
        }
        return movie;
    }

    buildSearchIndex() {
        this.searchIndex.clear();
        this.movies.forEach(movie => {
            const terms = [
                movie.title.toLowerCase(),
                ...(movie.genres || []).map(g => g.toLowerCase()),
                movie.type
            ];
            
            this.searchIndex.set(movie.id, terms);
        });
    }

    searchMovies(query) {
        const searchTerm = query.toLowerCase();
        return this.movies.filter(movie => {
            const terms = this.searchIndex.get(movie.id) || [];
            return terms.some(term => term.includes(searchTerm));
        });
    }

    migrateData() {
        let needsSave = false;
        
        this.movies.forEach(movie => {
            // Ensure all movies have required fields
            if (!movie.userRating) {
                movie.userRating = 0;
                needsSave = true;
            }
            if (!movie.userReview) {
                movie.userReview = '';
                needsSave = true;
            }
            if (!movie.lastUpdated) {
                movie.lastUpdated = Date.now();
                needsSave = true;
            }
            
            // Migrate episode structure
            if (movie.type === 'tv' && movie.watchedEpisodes) {
                movie.watchedEpisodes.forEach(ep => {
                    if (!ep.episodeId) {
                        ep.episodeId = `${ep.season}-${ep.episode}`;
                        needsSave = true;
                    }
                });
            }
        });
        
        if (needsSave) {
            this.saveMovies();
            console.log('Data migration completed');
        }
    }

    getStats() {
        return {
            total: this.movies.length,
            movies: this.movies.filter(m => m.type === 'movie').length,
            tvShows: this.movies.filter(m => m.type === 'tv').length,
            watched: this.movies.filter(m => m.watched).length
        };
    }

    // Export data for backup
    exportData() {
        return {
            version: CONFIG.APP.VERSION,
            exportDate: new Date().toISOString(),
            movies: this.movies,
            statistics: this.getStats()
        };
    }

    // Import data from backup
    importData(data) {
        if (!this.validateImportData(data)) {
            throw new Error('Invalid import data');
        }
        
        this.movies = data.movies;
        this.migrateData(); // Ensure imported data matches current schema
        this.saveMovies();
        eventBus.emit('data:imported', { movieCount: this.movies.length });
        
        return this.movies;
    }

    validateImportData(data) {
        if (!data || typeof data !== 'object') return false;
        if (!Array.isArray(data.movies)) return false;
        if (!data.version) return false;
        
        // Basic validation of each movie
        return data.movies.every(movie => this.validateMovie(movie));
    }
}