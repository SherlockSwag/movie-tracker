// tmdbService.js
class TMDBService {
    constructor() {
        this.cache = new Map();
        this.setupSearchEvents();
    }

    setupSearchEvents() {
        const movieInput = document.getElementById('movieInput');
        if (movieInput) {
            movieInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchTMDB();
            });
        }
    }

    async request(url) {
        // Simple cache check
        if (this.cache.has(url)) {
            return this.cache.get(url);
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            this.cache.set(url, data);
            return data;
        } catch (error) {
            console.error('TMDB request failed:', error);
            throw error;
        }
    }

    async searchTMDB() {
        const query = document.getElementById('movieInput')?.value.trim();
        const mediaType = document.getElementById('mediaType')?.value;
        
        if (!query) {
            app.showNotification('Please enter a search term');
            return;
        }
        
        try {
            const searchType = mediaType === 'tv' ? 'tv' : 'movie';
            const url = `${CONFIG.TMDB.BASE_URL}/search/${searchType}?api_key=${CONFIG.TMDB.API_KEY}&query=${encodeURIComponent(query)}`;
            const data = await this.request(url);
            this.displaySearchResults(data, mediaType);
        } catch (error) {
            app.showNotification('Search failed. Please try again.');
        }
    }

    displaySearchResults(data, mediaType) {
        const resultsContainer = document.getElementById('searchResults');
        const resultsList = document.getElementById('searchResultsList');
        
        if (!resultsList) return;
        
        const results = data.results || [];
        
        if (results.length === 0) {
            resultsList.innerHTML = '<div class="no-results">No results found.</div>';
            resultsContainer.style.display = 'block';
            return;
        }
        
        resultsList.innerHTML = results.slice(0, 10).map(item => {
            const isMovie = mediaType === 'movie';
            const title = isMovie ? item.title : item.name;
            const year = isMovie ? 
                (item.release_date ? new Date(item.release_date).getFullYear() : '') :
                (item.first_air_date ? new Date(item.first_air_date).getFullYear() : '');
            
            return `
                <div class="search-result-item" onclick="tmdbService.handleResultClick(${item.id}, '${mediaType}')">
                    <div class="result-poster">
                        ${item.poster_path ? 
                            `<img src="${this.getImageURL(item.poster_path, 'w200')}" alt="${title}" />` :
                            '<div class="no-poster">No Image</div>'
                        }
                    </div>
                    <div class="result-info">
                        <div class="result-title">${title} ${year ? `(${year})` : ''}</div>
                        <div class="result-overview">${item.overview ? item.overview.substring(0, 150) + '...' : 'No description available.'}</div>
                        <div class="result-rating">⭐ ${item.vote_average ? Math.round(item.vote_average * 10) / 10 : 'N/A'}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        resultsContainer.style.display = 'block';
    }

    async handleResultClick(tmdbId, type) {
        const existingItem = dataManager.movies.find(m => m.tmdb_id === tmdbId && m.type === type);
        
        if (existingItem) {
            app.showDetailPage(existingItem.id);
        } else {
            app.showTMDBDetailPage(tmdbId, type);
        }
    }

    async getMovieDetails(movieId) {
        const url = `${CONFIG.TMDB.BASE_URL}/movie/${movieId}?api_key=${CONFIG.TMDB.API_KEY}&append_to_response=credits`;
        return await this.request(url);
    }

    async getTVDetails(tvId) {
        const url = `${CONFIG.TMDB.BASE_URL}/tv/${tvId}?api_key=${CONFIG.TMDB.API_KEY}&append_to_response=credits`;
        const tvData = await this.request(url);
        
        // Load season details
        if (tvData && tvData.number_of_seasons > 0) {
            const seasonPromises = [];
            for (let i = 1; i <= tvData.number_of_seasons; i++) {
                seasonPromises.push(this.getSeasonDetails(tvId, i));
            }
            
            const seasons = await Promise.allSettled(seasonPromises);
            tvData.seasons_data = seasons
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value)
                .filter(season => season);
        }
        
        return tvData;
    }

    async getSeasonDetails(tvId, seasonNumber) {
        try {
            const url = `${CONFIG.TMDB.BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${CONFIG.TMDB.API_KEY}`;
            return await this.request(url);
        } catch (error) {
            console.warn(`Failed to load season ${seasonNumber}`);
            return null;
        }
    }

    async getStreamingAvailability(tmdbId, type) {
        try {
            const url = `${CONFIG.TMDB.BASE_URL}/${type}/${tmdbId}/watch/providers?api_key=${CONFIG.TMDB.API_KEY}`;
            const response = await this.request(url);
            return response.results?.SG || response.results?.US || {};
        } catch (error) {
            console.error('Error fetching streaming:', error);
            return {};
        }
    }

    formatMovieData(tmdbData) {
        return {
            tmdb_id: tmdbData.id,
            title: tmdbData.title,
            type: 'movie',
            year: tmdbData.release_date ? new Date(tmdbData.release_date).getFullYear() : 'Unknown',
            overview: tmdbData.overview || 'No description available.',
            poster: this.getImageURL(tmdbData.poster_path),
            rating: tmdbData.vote_average ? Math.round(tmdbData.vote_average * 10) / 10 : 0,
            genres: tmdbData.genres ? tmdbData.genres.map(g => g.name) : [],
            runtime: tmdbData.runtime || 0,
            cast: tmdbData.credits?.cast ? tmdbData.credits.cast.slice(0, 5).map(a => a.name) : [],
            release_date: tmdbData.release_date
        };
    }

    formatTVData(tmdbData) {
        const totalEpisodes = tmdbData.seasons_data ? 
            tmdbData.seasons_data.reduce((total, season) => total + (season.episodes?.length || 0), 0) : 
            tmdbData.number_of_episodes || 0;
        
        return {
            tmdb_id: tmdbData.id,
            title: tmdbData.name,
            type: 'tv',
            year: tmdbData.first_air_date ? new Date(tmdbData.first_air_date).getFullYear() : 'Unknown',
            overview: tmdbData.overview || 'No description available.',
            poster: this.getImageURL(tmdbData.poster_path),
            rating: tmdbData.vote_average ? Math.round(tmdbData.vote_average * 10) / 10 : 0,
            genres: tmdbData.genres ? tmdbData.genres.map(g => g.name) : [],
            total_seasons: tmdbData.number_of_seasons || 1,
            total_episodes: totalEpisodes,
            seasons_data: tmdbData.seasons_data || [],
            cast: tmdbData.credits?.cast ? tmdbData.credits.cast.slice(0, 5).map(a => a.name) : [],
            status: tmdbData.status || 'Unknown',
            first_air_date: tmdbData.first_air_date
        };
    }

    getImageURL(path, size = 'w500') {
        if (!path) return null;
        return `${CONFIG.TMDB.IMAGE_BASE_URL}${size}${path}`;
    }

    async loadDataForItems(items) {
        for (const item of items) {
            if (!item.tmdb_id || item.tmdb_data) continue;
            
            try {
                let tmdbData;
                if (item.type === 'movie') {
                    tmdbData = await this.getMovieDetails(item.tmdb_id);
                    item.tmdb_data = this.formatMovieData(tmdbData);
                } else {
                    tmdbData = await this.getTVDetails(item.tmdb_id);
                    item.tmdb_data = this.formatTVData(tmdbData);
                }
            } catch (error) {
                console.error(`Failed to load TMDB data for ${item.title}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, CONFIG.TMDB.RATE_LIMIT_DELAY));
        }
        
        dataManager.saveMovies();
    }
}