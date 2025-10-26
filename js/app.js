// app.js
class MovieTrackerApp {
    constructor() {
        this.initialized = false;
        this.init();
    }

    async init() {
        try {
            // Initialize core systems in correct order
            await this.initializeCoreSystems();
            this.setupEventHandlers();
            this.setupInterModuleCommunication();
            await this.loadInitialData();
            
            this.initialized = true;
            console.log('Movie Tracker App initialized successfully');
            
        } catch (error) {
            console.error('App init error:', error);
        }
    }

    async initializeCoreSystems() {
        console.log('Initializing core systems...');
        
        // Initialize in correct dependency order
        this.eventBus = new EventBus();
        this.performance = new PerformanceOptimizer();
        this.dataManager = new DataManager();
        
        // Load data FIRST
        console.log('Before loadMovies call');
        await this.dataManager.loadMovies();
        console.log('DataManager: Loaded', this.dataManager.movies.length, 'movies');
        
        // Debug: Check what's actually in dataManager
        console.log('DataManager movies sample:', this.dataManager.movies.slice(0, 3));
        
        // NOW initialize stateManager with the loaded movies
        this.stateManager = new StateManager(this.dataManager.movies);
        console.log('StateManager: Initialized with', this.stateManager.getState().movies.length, 'movies');
        
        // Debug: Verify stats
        console.log('StateManager stats:', this.stateManager.getState().stats);
        
        // Make core systems globally available
        window.stateManager = this.stateManager;
        window.dataManager = this.dataManager;
        window.eventBus = this.eventBus;
        
        // Initialize TMDB service EARLY (before filterManager)
        this.tmdbService = new TMDBService();
        window.tmdbService = this.tmdbService;
        
        // Initialize UI systems that depend on stateManager AND tmdbService
        this.uiManager = new UIManager();
        this.filterManager = new FilterManager();
        
        // Make filterManager available globally
        window.filterManager = this.filterManager;
        window.uiManager = this.uiManager;
        
        // Initialize router AFTER filterManager is available
        this.router = new Router();
        window.router = this.router;
        
        // Initialize other services
        this.episodeManager = new EpisodeManager();
        this.importExportManager = new ImportExportManager();
        
        window.episodeManager = this.episodeManager;
        window.importExportManager = this.importExportManager;
        window.app = this;
        
        console.log('All core systems initialized');
    }

    setupEventHandlers() {
        // Global event delegation for all actions
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (target) {
                this.handleAction(target.dataset.action, target.dataset, e);
            }
        });

        // Global input handlers
        document.addEventListener('input', (e) => {
            if (e.target.matches('#globalSearch')) {
                this.performance.debounce('global-search', () => {
                    this.filterManager.applyFilters();
                });
            }
        });

        console.log('Event handlers setup complete');
    }

    setupInterModuleCommunication() {
        // Data changes
        this.eventBus.on('movies:updated', (movies) => {
            this.stateManager.setMovies(movies);
            this.filterManager.displayFilteredMovies();
        });

        this.eventBus.on('movie:added', (data) => {
            console.log('Movie added:', data.movie.title);
        });

        this.eventBus.on('movie:updated', (data) => {
            console.log('Movie updated:', data.movie.title);
        });

        this.eventBus.on('movie:deleted', (data) => {
            console.log('Movie deleted:', data.movie.title);
        });

        console.log('Inter-module communication setup complete');
    }

    handleAction(action, data, event) {
        if (!action) return;

        console.log('Action triggered:', action, data);

        try {
            switch (action) {
                case 'toggle-watched':
                    this.toggleWatched(parseInt(data.id));
                    break;
                    
                case 'delete-movie':
                    this.deleteMovie(parseInt(data.id));
                    break;
                    
                case 'show-rating-modal':
                    this.showRatingModal(parseInt(data.id));
                    break;
                    
                // RATING ACTIONS
                case 'set-rating':
                    this.setRating(parseInt(data.id), parseInt(data.rating));
                    break;
                    
                case 'save-review':
                    this.saveReview(parseInt(data.id));
                    break;
                    
                case 'delete-review':
                    this.deleteReview(parseInt(data.id));
                    break;
                    
                case 'skip-rating':
                    this.skipRating(parseInt(data.id));
                    break;
                    
                // EPISODE MANAGER ACTIONS
                case 'change-season-filter':
                    if (this.episodeManager) {
                        const seasonSelect = event.target.closest('select');
                        if (seasonSelect) {
                            this.episodeManager.changeSeasonFilter(parseInt(seasonSelect.value));
                        }
                    }
                    break;
                    
                case 'change-season':
                    if (this.episodeManager) {
                        this.episodeManager.changeSeason(data.direction);
                    }
                    break;
                    
                case 'toggle-episode':
                    if (this.episodeManager) {
                        this.episodeManager.toggleEpisode(parseInt(data.season), parseInt(data.episode));
                    }
                    break;
                    
                case 'mark-season-watched':
                    if (this.episodeManager) {
                        this.episodeManager.markSeasonWatched(parseInt(data.season));
                    }
                    break;
                    
                case 'mark-all-watched':
                    if (this.episodeManager) {
                        this.episodeManager.markAllEpisodesWatched();
                    }
                    break;
                    
                case 'mark-all-unwatched':
                    if (this.episodeManager) {
                        this.episodeManager.markAllEpisodesUnwatched();
                    }
                    break;
                    
                case 'close-modal':
                    this.uiManager.hideModal(data.modal);
                    break;
                    
                case 'remove-filter':
                    this.filterManager.removeFilter(data.type);
                    break;
                    
                case 'export-data':
                    this.importExportManager.exportData();
                    break;
                    
                case 'navigate-home':
                    event?.preventDefault();
                    if (this.router) {
                        this.router.navigate('/');
                    }
                    break;

                case 'manage-episodes': {
                    event?.preventDefault();
                    const movieId = parseInt(data.id);
                    this.episodeManager.openEpisodeManager(movieId);
                    break;
                }

                case 'navigate-to-detail': {
                    const movieId = parseInt(data.id);
                    const mediaType = data.type;
                    console.log('Navigating to detail:', movieId, mediaType);
                    
                    if (this.router) {
                        this.router.navigate(`/${mediaType}/${movieId}`);
                    }
                    break;
                }
                        
                default:
                    console.warn('Unknown action:', action, data);
            }
        } catch (error) {
            console.error(`Action handler failed: ${action}`, error);
        }
    }

    async loadInitialData() {
        this.stateManager.setLoading(true);
        
        try {
            // Apply filters to display movies
            this.filterManager.displayFilteredMovies();
            
            console.log('Initial data loaded:', this.dataManager.movies.length, 'movies');
            
        } catch (error) {
            console.error('Initial data loading failed', error);
            throw error;
        } finally {
            this.stateManager.setLoading(false);
        }
    }

    // Public API methods
    toggleWatched(id) {
        const movie = this.dataManager.getMovieById(id);
        if (!movie) return;

        // For TV shows, only open episode manager - don't toggle watched status
        if (movie.type === 'tv') {
            this.episodeManager.openEpisodeManager(id);
            return; // Stop here for TV shows
        }

        // For movies, proceed with normal toggle behavior
        this.dataManager.toggleWatched(id);
        
        if (movie.watched && (!movie.userRating || movie.userRating === 0)) {
            setTimeout(() => {
                this.showRatingModal(id);
            }, 300);
        }
    }

    deleteMovie(id) {
        if (confirm('Are you sure you want to remove this item?')) {
            const movieId = parseInt(id);
            this.dataManager.deleteMovie(movieId);
            if (this.router) {
                this.router.navigate('/');
            }
        }
    }

    showRatingModal(movieId) {
        const movie = this.dataManager.getMovieById(movieId);
        if (!movie) return;

        if (!movie.watched) {
            this.uiManager.showNotification('Please mark as watched before rating.');
            return;
        }

        const isNewRating = !movie.userRating || movie.userRating === 0;
        
        const modalContent = `
            <h2>${isNewRating ? 'Rate & Review: ' : 'Edit Rating: '}${movie.title}</h2>
            <span class="close-modal" data-action="close-modal" data-modal="ratingModal">&times;</span>
            
            <div class="rating-info">
                <div class="watch-status">✓ Marked as Watched</div>
            </div>
            
            <div class="rating-section">
                <label>Your Rating:</label>
                <div class="star-rating">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(star => `
                        <span class="star ${movie.userRating >= star ? 'active' : ''}" 
                            data-action="set-rating" data-id="${movieId}" data-rating="${star}">⭐</span>
                    `).join('')}
                </div>
                <div class="rating-value">${movie.userRating || 'Not rated'}/10</div>
            </div>
            
            <div class="review-section">
                <label for="userReview">Your Review:</label>
                <textarea id="userReview" placeholder="Write your thoughts about this ${movie.type}...">${movie.userReview || ''}</textarea>
            </div>
            
            <div class="review-actions">
                <button data-action="save-review" data-id="${movieId}" class="action-btn save-btn">
                    ${isNewRating ? 'Save Review' : 'Update Review'}
                </button>
                ${movie.userReview ? `
                    <button data-action="delete-review" data-id="${movieId}" class="action-btn delete-btn">
                        Delete Review
                    </button>
                ` : ''}
                ${isNewRating ? `
                    <button data-action="skip-rating" data-id="${movieId}" class="action-btn skip-btn">
                        Skip for Now
                    </button>
                ` : ''}
                <button data-action="close-modal" data-modal="ratingModal" class="action-btn cancel-btn">
                    Close
                </button>
            </div>
        `;
        
        document.getElementById('ratingModalContent').innerHTML = modalContent;
        this.stateManager.setUIModal('rating', true);
    }

    setRating(movieId, rating) {
        const movie = this.dataManager.getMovieById(movieId);
        if (movie) {
            movie.userRating = rating;
            this.dataManager.saveMovies();
            this.showRatingModal(movieId);
        }
    }

    saveReview(movieId) {
        const movie = this.dataManager.getMovieById(movieId);
        const reviewText = document.getElementById('userReview')?.value || '';
        
        if (movie) {
            movie.userReview = reviewText;
            this.dataManager.saveMovies();
            this.stateManager.setUIModal('rating', false);
            this.uiManager.showNotification('Review saved successfully!', 'success');
        }
    }

    deleteReview(movieId) {
        const movie = this.dataManager.getMovieById(movieId);
        if (movie) {
            movie.userReview = '';
            movie.userRating = 0;
            this.dataManager.saveMovies();
            this.stateManager.setUIModal('rating', false);
            this.uiManager.showNotification('Review deleted!', 'success');
        }
    }

    skipRating(movieId) {
        this.stateManager.setUIModal('rating', false);
    }

    showTab(tabName) {
        this.uiManager.showTab(tabName);
    }

    refreshUI() {
        this.filterManager.displayFilteredMovies();
    }
}

// ==================== GLOBAL FUNCTIONS ====================

// Navigation functions
window.navigateToMovieDetail = function(movieId, mediaType) {
    console.log('navigateToMovieDetail called:', movieId, mediaType);
    
    if (mediaType === 'home') {
        if (window.router) {
            window.router.navigate('/');
        }
        return;
    }
    
    if (window.router) {
        window.router.navigate(`/${mediaType}/${movieId}`);
    } else {
        window.location.hash = `#/${mediaType}/${movieId}`;
    }
};

// TMDB Search functions
window.searchTMDB = function() {
    console.log('searchTMDB called');
    if (window.tmdbService) {
        window.tmdbService.searchTMDB();
    } else {
        console.error('tmdbService not available');
    }
};

window.handleSearchResultClick = function(tmdbId, type) {
    console.log('Search result clicked:', tmdbId, type);
    
    let existingItem = null;
    if (window.dataManager && window.dataManager.movies) {
        existingItem = window.dataManager.movies.find(movie => 
            movie.tmdb_id === tmdbId && movie.type === type
        );
    }
    
    if (existingItem) {
        console.log('Item found in collection, navigating to detail page');
        window.navigateToMovieDetail(existingItem.id, existingItem.type);
    } else {
        console.log('Item not in collection, creating temporary detail page');
        window.showTMDBDetailPage(tmdbId, type);
    }
};

window.showTMDBDetailPage = function(tmdbId, type) {
    console.log('Showing TMDB detail page:', tmdbId, type);
    
    const routeId = 'tmdb-' + tmdbId;
    
    if (window.router) {
        window.router.navigate(`/${type}/${routeId}`);
    } else {
        window.location.hash = `#/${type}/${routeId}`;
    }
};

window.selectTMDBItem = function(tmdbId, type) {
    console.log('selectTMDBItem called:', tmdbId, type);
    if (window.tmdbService) {
        window.tmdbService.selectTMDBItem(tmdbId, type);
    }
};

window.addTMDBItemToCollection = function(tmdbId, type) {
    console.log('Adding TMDB item to collection:', tmdbId, type);
    if (window.tmdbService) {
        window.tmdbService.selectTMDBItem(tmdbId, type);
    }
};

window.addToCollectionSimple = async function(tmdbId, type) {
    console.log('Simple add function called:', tmdbId, type);
    
    try {
        if (window.stateManager) window.stateManager.setLoading(true);
        
        let tmdbData;
        if (type === 'movie') {
            tmdbData = await window.tmdbService.getMovieDetails(tmdbId);
        } else {
            tmdbData = await window.tmdbService.getTVDetails(tmdbId);
        }
        
        if (!tmdbData) {
            throw new Error('Failed to fetch details from TMDB');
        }
        
        const formattedData = type === 'movie' ? 
            window.tmdbService.formatMovieDataForDisplay(tmdbData) :
            window.tmdbService.formatTVDataForDisplay(tmdbData);
        
        const movieData = {
            tmdb_id: formattedData.tmdb_id,
            title: formattedData.title,
            type: formattedData.type,
            year: formattedData.year,
            totalSeasons: formattedData.total_seasons || 1,
            totalEpisodes: formattedData.total_episodes || 10,
            genres: formattedData.genres || [],
            tmdb_data: formattedData
        };
        
        const newMovie = window.dataManager.addMovie(movieData);
        
        if (newMovie) {
            window.dataManager.saveMovies();
            // Show success notification
            setTimeout(() => {
                if (window.router) {
                    window.router.navigate('/');
                }
            }, 1500);
        }
        
    } catch (error) {
        console.error('Simple add failed:', error);
    } finally {
        if (window.stateManager) window.stateManager.setLoading(false);
    }
};

// UI Functions
window.showTab = function(tabName) {
    if (window.app) window.app.showTab(tabName);
};

window.toggleWatched = function(id) {
    if (window.app) window.app.toggleWatched(id);
};

window.deleteMovie = function(id) {
    if (window.app) window.app.deleteMovie(id);
};

window.showImportExportModal = function() {
    if (window.importExportManager) window.importExportManager.showImportExportModal();
};

window.applyFilters = function() {
    if (window.filterManager) window.filterManager.applyFilters();
};

window.clearAllFilters = function() {
    if (window.filterManager) window.filterManager.clearAllFilters();
};

window.showTMDBItemDetails = function(tmdbId, type) {
    console.log('showTMDBItemDetails called:', tmdbId, type);
    
    const existingItem = window.dataManager.movies.find(movie => movie.tmdb_id === tmdbId);
    
    if (existingItem) {
        console.log('Item found in collection, navigating to detail page');
        window.navigateToMovieDetail(existingItem.id, existingItem.type);
    } else {
        console.log('Item not in collection, showing TMDB details');
        if (window.tmdbService) {
            window.tmdbService.selectTMDBItem(tmdbId, type);
        }
    }
};

window.refreshCollection = function() {
    console.log('Refreshing collection data...');
    
    if (window.dataManager) {
        window.dataManager.loadMovies();
        
        if (window.stateManager) {
            window.stateManager.setMovies(window.dataManager.movies);
        }
        
        if (window.filterManager) {
            window.filterManager.displayFilteredMovies();
        }
    }
};

window.emergencyNavigateToDetail = function(movieId, type) {
    console.log('EMERGENCY NAVIGATION:', movieId, type);
    
    if (window.dataManager) {
        window.dataManager.loadMovies();
        const movie = window.dataManager.movies.find(m => m.id === movieId);
        if (movie) {
            if (window.router) {
                window.router.navigate(`/${type}/${movieId}`);
            } else {
                window.location.hash = `#/${type}/${movieId}`;
            }
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MovieTrackerApp();
    console.log('App initialization started');
});

console.log('Global functions loaded:', {
    searchTMDB: typeof window.searchTMDB,
    navigateToMovieDetail: typeof window.navigateToMovieDetail,
    handleSearchResultClick: typeof window.handleSearchResultClick
});