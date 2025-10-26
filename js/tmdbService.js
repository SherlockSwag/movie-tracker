// tmdbService.js
class TMDBService {
    constructor() {
        this.apiService = new ApiService();
        this.imageCache = new Map();
        this.setupSearchEvents();
    }

    setupSearchEvents() {
        const movieInput = document.getElementById('movieInput');
        if (movieInput) {
            movieInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchTMDB();
                }
            });
        }
    }

    async searchTMDB() {
        const query = document.getElementById('movieInput')?.value.trim();
        const mediaType = document.getElementById('mediaType')?.value;
        
        if (!query) {
            ErrorHandler.showUserNotification('Please enter a search term');
            return;
        }
        
        stateManager.setLoading(true);
        
        try {
            const results = await this.performSearch(query, mediaType);
            this.displaySearchResults(results);
        } catch (error) {
            ErrorHandler.logError('TMDB Search Failed', error);
            ErrorHandler.showUserNotification('Search failed. Please try again.');
        } finally {
            stateManager.setLoading(false);
        }
    }

    async performSearch(query, mediaType) {
        if (!query || query.length < 2) {
            throw new Error('Search query must be at least 2 characters');
        }
        
        const searchType = mediaType === 'tv' ? 'tv' : 'movie';
        const endpoint = `${CONFIG.TMDB.BASE_URL}/search/${searchType}?api_key=${CONFIG.TMDB.API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`;
        
        const data = await this.apiService.request(endpoint);
        
        // Validate response structure
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid API response');
        }
        
        return data;
    }

    displaySearchResults(data) {
        const resultsContainer = document.getElementById('searchResults');
        const resultsList = document.getElementById('searchResultsList');
        
        if (!resultsList || !resultsContainer) return;
        
        const results = data.results || [];
        
        if (results.length === 0) {
            resultsList.innerHTML = '<div class="no-results">No results found. Try a different search term.</div>';
            resultsContainer.style.display = 'block';
            return;
        }
        
        resultsList.innerHTML = results.slice(0, 10).map(item => {
            const isMovie = item.media_type === 'movie' || !item.name;
            const title = isMovie ? item.title : item.name;
            const year = isMovie ? 
                (item.release_date ? new Date(item.release_date).getFullYear() : '') :
                (item.first_air_date ? new Date(item.first_air_date).getFullYear() : '');
            
            return `
                <div class="search-result-item" 
                    onclick="window.handleSearchResultClick(${item.id}, '${isMovie ? 'movie' : 'tv'}')">
                    <div class="result-poster">
                        ${item.poster_path ? 
                            `<img src="${this.getImageURL(item.poster_path, 'w200')}" alt="${title}" loading="lazy" />` :
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

    async selectTMDBItem(tmdbId, type) {
        stateManager.setLoading(true);
        
        try {
            let tmdbData;
            let formattedData;
            
            if (type === 'movie') {
                tmdbData = await this.getMovieDetails(tmdbId);
                formattedData = this.formatMovieDataForDisplay(tmdbData);
            } else {
                tmdbData = await this.getTVDetails(tmdbId);
                formattedData = this.formatTVDataForDisplay(tmdbData);
            }
            
            if (!tmdbData) {
                throw new Error('Failed to load details from TMDB');
            }
            
            this.showItemDetails(formattedData, type);
            
        } catch (error) {
            ErrorHandler.logError('TMDB Item Selection Failed', error);
            ErrorHandler.showUserNotification('Error loading details. Please try again.');
        } finally {
            stateManager.setLoading(false);
        }
    }

    async getMovieDetails(movieId) {
        const endpoint = `${CONFIG.TMDB.BASE_URL}/movie/${movieId}?api_key=${CONFIG.TMDB.API_KEY}&append_to_response=credits`;
        return await this.apiService.request(endpoint);
    }

    async getTVDetails(tvId) {
        const endpoint = `${CONFIG.TMDB.BASE_URL}/tv/${tvId}?api_key=${CONFIG.TMDB.API_KEY}&append_to_response=credits`;
        const tvData = await this.apiService.request(endpoint);
        
        if (tvData && tvData.number_of_seasons > 0) {
            // Load season data in parallel
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
        const endpoint = `${CONFIG.TMDB.BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${CONFIG.TMDB.API_KEY}`;
        
        try {
            return await this.apiService.request(endpoint);
        } catch (error) {
            console.warn(`Failed to load season ${seasonNumber} for TV show ${tvId}:`, error);
            return null;
        }
    }

    async getStreamingAvailability(tmdbId, type, region = 'SG') {
        try {
            const endpoint = `${CONFIG.TMDB.BASE_URL}/${type}/${tmdbId}/watch/providers?api_key=${CONFIG.TMDB.API_KEY}`;
            const response = await this.apiService.request(endpoint);
            
            // Try Singapore first, then fallback to US
            return response.results?.[region] || response.results?.US || {};
        } catch (error) {
            console.error('Error fetching streaming availability:', error);
            return {};
        }
    }

    formatMovieDataForDisplay(tmdbData) {
        if (!tmdbData) return null;
        
        const year = tmdbData.release_date ? new Date(tmdbData.release_date).getFullYear() : 'Unknown';
        
        return {
            tmdb_id: tmdbData.id,
            title: tmdbData.title || 'Unknown Movie',
            type: 'movie',
            year: year,
            overview: tmdbData.overview || 'No description available.',
            poster: this.getImageURL(tmdbData.poster_path),
            rating: tmdbData.vote_average ? Math.round(tmdbData.vote_average * 10) / 10 : 0,
            genres: tmdbData.genres ? tmdbData.genres.map(g => g.name) : [],
            runtime: tmdbData.runtime || 0,
            cast: tmdbData.credits?.cast ? tmdbData.credits.cast.slice(0, 5).map(actor => actor.name) : [],
            release_date: tmdbData.release_date
        };
    }

    // In tmdbService.js - formatTVDataForDisplay method
    formatTVDataForDisplay(tmdbData) {
        if (!tmdbData) return null;
        
        const year = tmdbData.first_air_date ? new Date(tmdbData.first_air_date).getFullYear() : 'Unknown';
        const totalEpisodes = tmdbData.seasons_data ? 
            tmdbData.seasons_data.reduce((total, season) => total + (season.episodes?.length || 0), 0) : 
            tmdbData.number_of_episodes || 0;
        
        return {
            tmdb_id: tmdbData.id,
            title: tmdbData.name || 'Unknown TV Show',
            type: 'tv',
            year: year,
            overview: tmdbData.overview || 'No description available.',
            poster: this.getImageURL(tmdbData.poster_path),
            rating: tmdbData.vote_average ? Math.round(tmdbData.vote_average * 10) / 10 : 0,
            genres: tmdbData.genres ? tmdbData.genres.map(g => g.name) : [],
            total_seasons: tmdbData.number_of_seasons || 1,
            total_episodes: totalEpisodes,
            seasons_data: tmdbData.seasons_data || [], // Ensure this is included
            cast: tmdbData.credits?.cast ? tmdbData.credits.cast.slice(0, 5).map(actor => actor.name) : [],
            status: tmdbData.status || 'Unknown',
            first_air_date: tmdbData.first_air_date,
            // Add the main TMDB properties for fallback
            number_of_seasons: tmdbData.number_of_seasons,
            number_of_episodes: tmdbData.number_of_episodes
        };
    }

    showItemDetails(itemData, type) {
        const modal = document.getElementById('itemDetailsModal');
        const content = document.getElementById('itemDetailsModalContent');
        
        if (!content) return;
        
        const title = itemData.title || 'Unknown Title';
        const year = itemData.year || 'Unknown';
        const rating = itemData.rating || 'N/A';
        const overview = itemData.overview || 'No description available.';
        const poster = itemData.poster || null;
        const genres = Array.isArray(itemData.genres) ? itemData.genres : [];
        const cast = Array.isArray(itemData.cast) ? itemData.cast : [];
        const runtime = itemData.runtime || null;
        const totalSeasons = itemData.total_seasons || 0;
        
        content.innerHTML = `
            <h2>${title}</h2>
            <span class="close-modal" data-action="close-modal" data-modal="itemDetailsModal">&times;</span>
            
            <div class="item-details">
                <div class="item-poster">
                    ${poster ? 
                        `<img src="${poster}" alt="${title}" loading="lazy" />` :
                        '<div class="no-poster-large">No Image Available</div>'
                    }
                </div>
                <div class="item-info">
                    <div class="item-meta">
                        <span class="item-year">${year}</span>
                        <span class="item-rating">⭐ ${rating}</span>
                        ${type === 'tv' ? `<span class="item-seasons">${totalSeasons} season(s)</span>` : ''}
                        ${runtime ? `<span class="item-runtime">${runtime} min</span>` : ''}
                    </div>
                    
                    ${genres.length > 0 ? `
                        <div class="item-genres">
                            ${genres.map(genre => `<span class="genre-tag">${genre}</span>`).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="item-overview">
                        <h4>Overview</h4>
                        <p>${overview}</p>
                    </div>
                    
                    ${cast.length > 0 ? `
                        <div class="item-cast">
                            <h4>Cast</h4>
                            <p>${cast.slice(0, 5).join(', ')}</p>
                        </div>
                    ` : ''}
                    
                    <div class="item-actions">
                        <button data-action="add-tmdb-item" data-item='${JSON.stringify(itemData).replace(/"/g, '&quot;')}' class="action-btn add-btn">
                            Add to Collection
                        </button>
                        <button data-action="close-modal" data-modal="itemDetailsModal" class="action-btn cancel-btn">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        stateManager.setUIModal('itemDetails', true);
    }

// In tmdbService.js - REPLACE the addTMDBItemToCollection method
    addTMDBItemToCollection(itemData) {
        console.log('=== ADD TO COLLECTION START ===');
        console.log('Item data:', itemData);
        
        if (!itemData || !itemData.tmdb_id) {
            ErrorHandler.showUserNotification('Invalid item data');
            return;
        }
        
        try {
            // Create the movie data object
            const movieData = {
                tmdb_id: itemData.tmdb_id,
                title: itemData.title,
                type: itemData.type,
                year: itemData.year || new Date().getFullYear(),
                totalSeasons: itemData.total_seasons || 1,
                totalEpisodes: itemData.total_episodes || 10,
                genres: itemData.genres || [],
                tmdb_data: itemData
            };
            
            console.log('Movie data to add:', movieData);
            
            // Add to collection using DataManager
            const newMovie = dataManager.addMovie(movieData);
            console.log('New movie created:', newMovie);
            
            if (newMovie) {
                // Force save and refresh the UI
                dataManager.saveMovies();
                
                // Show success message
                ErrorHandler.showUserNotification(`"${movieData.title}" added to your collection!`, 'success');
                
                // Close the modal if open
                stateManager.setUIModal('itemDetails', false);
                
                // Navigate to home page to see the new item
                setTimeout(() => {
                    console.log('Navigating to home page');
                    if (window.router) {
                        window.router.navigate('/');
                    } else if (window.navigateToMovieDetail) {
                        window.navigateToMovieDetail('', 'home');
                    } else {
                        // Fallback - reload the page
                        window.location.href = '/';
                    }
                }, 1000);
                
            } else {
                throw new Error('Failed to create movie');
            }
            
        } catch (error) {
            console.error('Add to collection failed:', error);
            ErrorHandler.showUserNotification('Failed to add item: ' + error.message);
        }
        
        console.log('=== ADD TO COLLECTION END ===');
    }

    async loadTMDBDataForItems(items) {
        const batchSize = CONFIG.APP.BATCH_SIZE;
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            await Promise.allSettled(batch.map(item => this.loadSingleItemTMDBData(item)));
            await new Promise(resolve => setTimeout(resolve, CONFIG.TMDB.RATE_LIMIT_DELAY));
        }
    }

    async loadSingleItemTMDBData(item) {
        if (!item.tmdb_id) {
            this.showFallbackDisplay(item.id);
            return;
        }
        
        try {
            let tmdbData;
            if (item.type === 'movie') {
                tmdbData = await this.getMovieDetails(item.tmdb_id);
            } else {
                tmdbData = await this.getTVDetails(item.tmdb_id);
            }
            
            if (tmdbData) {
                this.updateItemDisplay(item.id, tmdbData);
            } else {
                this.showFallbackDisplay(item.id);
            }
        } catch (error) {
            console.error(`Failed to load TMDB data for ${item.title}:`, error);
            this.showFallbackDisplay(item.id);
        }
    }

    updateItemDisplay(movie) {
        // Remove the performance.batchDOMUpdates call and use direct DOM updates
        const posterElement = document.getElementById(`poster-${movie.id}`);
        const metaElement = document.getElementById(`meta-${movie.id}`);
        
        if (posterElement && movie.tmdb_data?.poster) {
            posterElement.innerHTML = `
                <img src="${movie.tmdb_data.poster}" alt="${movie.title}" 
                    onerror="this.style.display='none'" />
            `;
        }
        
        if (metaElement && movie.tmdb_data) {
            const year = movie.tmdb_data.year || movie.year || 'Unknown';
            const rating = movie.tmdb_data.rating ? 
                `⭐ ${Math.round(movie.tmdb_data.rating * 10) / 10}/10` : '';
            const genres = movie.tmdb_data.genres ? 
                movie.tmdb_data.genres.slice(0, 3).join(', ') : '';
            
            metaElement.innerHTML = `
                <div class="movie-year">${year}</div>
                ${rating ? `<div class="movie-rating">${rating}</div>` : ''}
                ${genres ? `<div class="movie-genres">${genres}</div>` : ''}
            `;
        }
    }

    showFallbackDisplay(itemId) {
        performance.batchDOMUpdates(() => {
            const posterContainer = document.getElementById(`poster-${itemId}`);
            const metaContainer = document.getElementById(`meta-${itemId}`);
            
            if (posterContainer) {
                posterContainer.innerHTML = '<div class="no-poster">No Image</div>';
            }
            if (metaContainer) {
                metaContainer.innerHTML = '<span class="meta-unavailable">Details unavailable</span>';
            }
        });
    }

    getImageURL(path, size = 'w500') {
        if (!path) return null;
        
        const cacheKey = `${size}${path}`;
        if (this.imageCache.has(cacheKey)) {
            return this.imageCache.get(cacheKey);
        }
        
        const url = `${CONFIG.TMDB.IMAGE_BASE_URL}${size}${path}`;
        this.imageCache.set(cacheKey, url);
        return url;
    }

    clearImageCache() {
        this.imageCache.clear();
    }
}