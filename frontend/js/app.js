// app.js
class MovieTrackerApp {
    constructor() {
        this.currentFilters = {
            search: '',
            genre: 'all',
            sortBy: 'addedDate',
            mediaType: 'all',
            watchStatus: 'all'
        };
        this.currentPage = 'home';
        this.init();
    }

    async init() {
        // Initialize managers
        window.apiClient = new ApiClient();
        window.tmdbService = new TMDBService();
        window.uiManager = new UIManager();
        window.filterManager = new FilterManager();
        window.episodeManager = new EpisodeManager();
        window.importExportManager = new ImportExportManager();
        window.app = this;
        
        // Load data
        dataManager.loadMovies();
        
        // Initial render
        this.refreshUI();
        
        // Setup global click handler
        this.setupEventHandlers();
        
        console.log('App initialized with', dataManager.movies.length, 'movies');
    }

    setupEventHandlers() {
        document.addEventListener('click', (e) => {
            const target = e.target;
            
            // Handle various button clicks
            if (target.matches('[onclick]')) return; // Let inline handlers work
            
            // You can add more global handlers here if needed
        });
    }

    refreshUI() {
        uiManager.updateStats(dataManager.getStats());
        filterManager.applyFilters();
    }

    toggleWatched(id) {
        const movie = dataManager.getMovieById(id);
        if (!movie) return;

        // For TV shows, open episode manager
        if (movie.type === 'tv') {
            episodeManager.openEpisodeManager(id);
            return;
        }

        // For movies, toggle watched status
        dataManager.toggleWatched(id);
        
        // Show rating modal if newly watched and not rated
        if (movie.watched && !movie.userRating) {
            setTimeout(() => this.showRatingModal(id), 300);
        }
        
        this.refreshUI();
    }

    deleteMovie(id) {
        if (confirm('Remove this item from your collection?')) {
            dataManager.deleteMovie(id);
            
            // If on detail page, go back home
            if (this.currentPage === 'detail') {
                this.showHomePage();
            }
            
            this.refreshUI();
        }
    }

    showRatingModal(movieId) {
        const movie = dataManager.getMovieById(movieId);
        if (!movie || !movie.watched) return;

        const isNew = !movie.userRating || movie.userRating === 0;
        const content = document.getElementById('ratingModalContent');
        
        content.innerHTML = `
            <h2>${isNew ? 'Rate & Review' : 'Edit Rating'}: ${this.escapeHTML(movie.title)}</h2>
            <span class="close-modal" onclick="uiManager.hideModal('ratingModal')">&times;</span>
            
            <div class="rating-section">
                <label>Your Rating:</label>
                <div class="star-rating">
                    ${[1,2,3,4,5,6,7,8,9,10].map(star => `
                        <span class="star ${movie.userRating >= star ? 'active' : ''}" 
                              onclick="app.setRating(${movieId}, ${star})">⭐</span>
                    `).join('')}
                </div>
                <div class="rating-value">${movie.userRating || 'Not rated'}/10</div>
            </div>
            
            <div class="review-section">
                <label for="userReview">Your Review:</label>
                <textarea id="userReview" placeholder="Write your thoughts...">${movie.userReview || ''}</textarea>
            </div>
            
            <div class="review-actions">
                <button class="action-btn save-btn" onclick="app.saveReview(${movieId})">
                    ${isNew ? 'Save Review' : 'Update Review'}
                </button>
                ${movie.userReview ? `
                    <button class="action-btn delete-btn" onclick="app.deleteReview(${movieId})">
                        Delete Review
                    </button>
                ` : ''}
                <button class="action-btn cancel-btn" onclick="uiManager.hideModal('ratingModal')">
                    Close
                </button>
            </div>
        `;
        
        uiManager.showModal('ratingModal');
    }

    setRating(movieId, rating) {
        const movie = dataManager.getMovieById(movieId);
        if (movie) {
            movie.userRating = rating;
            dataManager.saveMovies();
            this.showRatingModal(movieId); // Refresh modal
        }
    }

    saveReview(movieId) {
        const movie = dataManager.getMovieById(movieId);
        const reviewText = document.getElementById('userReview')?.value || '';
        
        if (movie) {
            movie.userReview = reviewText;
            dataManager.saveMovies();
            uiManager.hideModal('ratingModal');
            uiManager.showNotification('Review saved!', 'success');
            this.refreshUI();
        }
    }

    deleteReview(movieId) {
        const movie = dataManager.getMovieById(movieId);
        if (movie) {
            movie.userReview = '';
            movie.userRating = 0;
            dataManager.saveMovies();
            uiManager.hideModal('ratingModal');
            uiManager.showNotification('Review deleted!', 'success');
            this.refreshUI();
        }
    }

    // Detail page functionality
    showHomePage() {
        this.currentPage = 'home';
        document.getElementById('homePage').style.display = 'block';
        document.getElementById('detailPage').style.display = 'none';
        this.refreshUI();
    }

    showDetailPage(movieId) {
        const movie = dataManager.getMovieById(movieId);
        if (!movie) {
            this.showHomePage();
            return;
        }

        this.currentPage = 'detail';
        document.getElementById('homePage').style.display = 'none';
        document.getElementById('detailPage').style.display = 'block';
        
        this.renderDetailPage(movie);
    }

    async showTMDBDetailPage(tmdbId, type) {
        this.currentPage = 'detail';
        document.getElementById('homePage').style.display = 'none';
        document.getElementById('detailPage').style.display = 'block';
        
        const content = document.getElementById('detailContent');
        content.innerHTML = '<div class="loading-detail">Loading...</div>';
        
        try {
            let tmdbData;
            if (type === 'movie') {
                tmdbData = await tmdbService.getMovieDetails(tmdbId);
                tmdbData = tmdbService.formatMovieData(tmdbData);
            } else {
                tmdbData = await tmdbService.getTVDetails(tmdbId);
                tmdbData = tmdbService.formatTVData(tmdbData);
            }
            
            const tempItem = {
                id: 'tmdb-' + tmdbId,
                tmdb_id: tmdbId,
                type: type,
                title: tmdbData.title,
                tmdb_data: tmdbData,
                watched: false,
                userRating: 0,
                inCollection: false
            };
            
            this.renderDetailPage(tempItem);
        } catch (error) {
            content.innerHTML = `
                <div class="error-detail">
                    <h2>Failed to load details</h2>
                    <p>${error.message}</p>
                    <button onclick="app.showHomePage()" class="btn-primary">Back to Collection</button>
                </div>
            `;
        }
    }

    renderDetailPage(item) {
        const content = document.getElementById('detailContent');
        const tmdbData = item.tmdb_data || {};
        const isInCollection = !item.id.toString().startsWith('tmdb-');
        
        content.innerHTML = `
            <div class="detail-header">
                <button class="back-button" onclick="app.showHomePage()">
                    ← Back to Collection
                </button>
            </div>

            <div class="detail-content">
                <div class="detail-poster-section">
                    <div class="detail-poster">
                        ${tmdbData.poster ? 
                            `<img src="${tmdbData.poster}" alt="${item.title}" />` :
                            '<div class="no-poster-large">No Image</div>'
                        }
                    </div>
                    
                    ${this.createActionButtons(item, isInCollection)}
                    ${this.createProgressSection(item, isInCollection)}
                </div>

                <div class="detail-info-section">
                    <h1 class="detail-title">${this.escapeHTML(item.title)}</h1>
                    ${this.createMetadataSection(item, tmdbData, isInCollection)}
                    ${tmdbData.overview ? `
                        <div class="detail-section">
                            <h2>Synopsis</h2>
                            <p class="overview">${this.escapeHTML(tmdbData.overview)}</p>
                        </div>
                    ` : ''}
                    ${this.createCastSection(tmdbData)}
                    ${this.createStreamingSection(item)}
                </div>
            </div>
        `;
        
        // Load streaming data
        if (item.tmdb_id) {
            this.loadStreamingData(item.tmdb_id, item.type);
        }
    }

    createActionButtons(item, isInCollection) {
        if (!isInCollection) {
            return `
                <div class="action-buttons">
                    <button class="btn-primary" onclick="app.addToCollection(${item.tmdb_id}, '${item.type}')">
                        ➕ Add to Collection
                    </button>
                </div>
            `;
        }

        return `
            <div class="action-buttons">
                <button class="btn-primary" onclick="app.toggleWatched(${item.id})">
                    ${item.watched ? '✅ Watched' : '👁️ Mark Watched'}
                </button>
                ${item.watched ? `
                    <button class="btn-secondary" onclick="app.showRatingModal(${item.id})">
                        ${item.userRating ? `⭐ ${item.userRating}/10 - Edit` : '⭐ Rate & Review'}
                    </button>
                ` : ''}
                <button class="btn-danger" onclick="app.deleteMovie(${item.id})">
                    🗑️ Remove
                </button>
            </div>
        `;
    }

    createProgressSection(item, isInCollection) {
        if (item.type !== 'tv') return '';

        if (!isInCollection) {
            return `
                <div class="progress-section">
                    <h3>TV Show Info</h3>
                    <p>Add to collection to track episodes!</p>
                    ${item.tmdb_data?.total_seasons ? `
                        <p>${item.tmdb_data.total_seasons} seasons, ${item.tmdb_data.total_episodes} episodes</p>
                    ` : ''}
                </div>
            `;
        }

        const watchedEpisodes = item.watchedEpisodes?.filter(ep => ep.watched).length || 0;
        const totalEpisodes = item.watchedEpisodes?.length || 0;
        const progressPercent = totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0;

        return `
            <div class="progress-section">
                <h3>Episode Progress</h3>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%"></div>
                </div>
                <div class="progress-text">
                    ${watchedEpisodes}/${totalEpisodes} episodes (${progressPercent}%)
                </div>
                <button class="btn-outline" onclick="episodeManager.openEpisodeManager(${item.id})">
                    📺 Manage Episodes
                </button>
            </div>
        `;
    }

    createMetadataSection(item, tmdbData, isInCollection) {
        const metadata = [];

        if (item.type === 'movie' && tmdbData.runtime) {
            metadata.push(`<div class="metadata-item">
                <strong>Runtime:</strong> ${Math.floor(tmdbData.runtime / 60)}h ${tmdbData.runtime % 60}m
            </div>`);
        }

        if (item.type === 'tv' && tmdbData.total_seasons) {
            metadata.push(`<div class="metadata-item">
                <strong>Seasons:</strong> ${tmdbData.total_seasons}
            </div>`);
        }

        if (tmdbData.genres?.length) {
            metadata.push(`<div class="metadata-item">
                <strong>Genres:</strong> ${tmdbData.genres.slice(0, 5).join(', ')}
            </div>`);
        }
        
        if (tmdbData.rating) {
            metadata.push(`<div class="metadata-item">
                <strong>TMDB Rating:</strong> ⭐ ${Math.round(tmdbData.rating * 10) / 10}/10
            </div>`);
        }
        
        if (item.userRating && isInCollection) {
            metadata.push(`<div class="metadata-item">
                <strong>Your Rating:</strong> ⭐ ${item.userRating}/10
            </div>`);
        }
        
        if (tmdbData.release_date) {
            metadata.push(`<div class="metadata-item">
                <strong>Release:</strong> ${new Date(tmdbData.release_date).toLocaleDateString()}
            </div>`);
        }
        
        if (tmdbData.first_air_date) {
            metadata.push(`<div class="metadata-item">
                <strong>First Aired:</strong> ${new Date(tmdbData.first_air_date).toLocaleDateString()}
            </div>`);
        }

        if (item.addedDate && isInCollection) {
            metadata.push(`<div class="metadata-item">
                <strong>Added:</strong> ${item.addedDate}
            </div>`);
        }
        
        if (tmdbData.status) {
            metadata.push(`<div class="metadata-item">
                <strong>Status:</strong> ${tmdbData.status}
            </div>`);
        }

        if (metadata.length === 0) return '';

        return `
            <div class="detail-section">
                <h2>Details</h2>
                <div class="metadata-grid">
                    ${metadata.join('')}
                </div>
            </div>
        `;
    }

    createCastSection(tmdbData) {
        if (!tmdbData.cast || tmdbData.cast.length === 0) return '';

        return `
            <div class="detail-section">
                <h2>Cast</h2>
                <div class="cast-grid">
                    ${tmdbData.cast.slice(0, 8).map(actor => `
                        <div class="cast-member">
                            <div class="cast-name">${this.escapeHTML(actor)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    createStreamingSection(item) {
        return `
            <div class="detail-section">
                <h2>Where to Watch</h2>
                <div class="streaming-placeholder" id="streaming-${item.tmdb_id || item.id}">
                    <p>Loading...</p>
                </div>
            </div>
        `;
    }

    async loadStreamingData(tmdbId, type) {
        try {
            const streamingData = await tmdbService.getStreamingAvailability(tmdbId, type);
            const container = document.getElementById(`streaming-${tmdbId}`);
            if (!container) return;

            if (streamingData.flatrate && streamingData.flatrate.length > 0) {
                container.innerHTML = `
                    <p>Available on:</p>
                    <div class="streaming-badges">
                        ${streamingData.flatrate.slice(0, 5).map(provider => `
                            <span class="streaming-badge" style="background: ${this.getServiceColor(provider.provider_name)}">
                                ${provider.provider_name}
                            </span>
                        `).join('')}
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="streaming-unavailable">
                        <p>Not available for streaming subscription</p>
                        <small>Check platforms for rental/purchase</small>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load streaming data:', error);
            const container = document.getElementById(`streaming-${tmdbId}`);
            if (container) {
                container.innerHTML = `
                    <div class="streaming-unavailable">
                        <p>Streaming information unavailable</p>
                    </div>
                `;
            }
        }
    }

    getServiceColor(serviceName) {
        const colors = {
            'Netflix': '#E50914',
            'Disney Plus': '#113CCF',
            'Amazon Prime Video': '#00A8E1',
            'HBO Max': '#3D03A4',
            'Hulu': '#1CE783',
            'Apple TV Plus': '#000000',
            'Paramount Plus': '#0066CC'
        };
        return colors[serviceName] || '#666';
    }

    async addToCollection(tmdbId, type) {
        try {
            let tmdbData;
            if (type === 'movie') {
                tmdbData = await tmdbService.getMovieDetails(tmdbId);
                tmdbData = tmdbService.formatMovieData(tmdbData);
            } else {
                tmdbData = await tmdbService.getTVDetails(tmdbId);
                tmdbData = tmdbService.formatTVData(tmdbData);
            }
            
            const movieData = {
                tmdb_id: tmdbId,
                title: tmdbData.title,
                type: type,
                year: tmdbData.year,
                totalSeasons: tmdbData.total_seasons || 1,
                totalEpisodes: tmdbData.total_episodes || 10,
                genres: tmdbData.genres || [],
                tmdb_data: tmdbData
            };
            
            const newMovie = dataManager.addMovie(movieData);
            
            if (newMovie) {
                uiManager.showNotification(`"${newMovie.title}" added to collection!`, 'success');
                
                setTimeout(() => {
                    this.showHomePage();
                }, 1500);
            }
        } catch (error) {
            console.error('Failed to add to collection:', error);
            uiManager.showNotification('Failed to add item: ' + error.message, 'error');
        }
    }

    showNotification(message, type = 'info') {
        uiManager.showNotification(message, type);
    }

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MovieTrackerApp();
});