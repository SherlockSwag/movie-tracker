// uiManager.js
class UIManager {
    constructor() {
        this.performance = new PerformanceOptimizer();
        this.setupGlobalEventListeners();
        
        // Subscribe to state changes - use window.stateManager
        if (window.stateManager) {
            window.stateManager.subscribe((state, previousState) => {
                this.handleStateChange(state, previousState);
            });
            
            // IMMEDIATELY update stats on initialization
            const initialState = window.stateManager.getState();
            this.updateStatsDisplay(initialState.stats);
            console.log('UIManager: Initial stats loaded', initialState.stats);
        } else {
            console.warn('UIManager: stateManager not available during initialization');
        }
    }

    setupGlobalEventListeners() {
        // Modal close handlers
        document.addEventListener('click', (e) => {
            if (e.target.matches('.close-modal, [data-action="close-modal"]')) {
                const modalId = e.target.dataset.modal || 
                               e.target.closest('.episode-modal')?.id ||
                               this.findParentModalId(e.target);
                if (modalId) {
                    this.hideModal(modalId);
                }
            }
            
            // Backdrop clicks
            if (e.target.matches('.episode-modal')) {
                this.hideModal(e.target.id);
            }
        });

        // Keyboard handlers
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    findParentModalId(element) {
        const modal = element.closest('.episode-modal');
        return modal ? modal.id : null;
    }

    handleStateChange(state, previousState) {
        // Update stats display
        if (!previousState || state.stats !== previousState.stats) {
            this.updateStatsDisplay(state.stats);
        }

        // Handle modal state changes - add null checks
        const currentModals = state.ui?.modals || {};
        const previousModals = previousState?.ui?.modals || {};
        this.handleModalStateChanges(currentModals, previousModals);

        // Handle loading state
        this.handleLoadingState(state.ui?.loading);
    }

    handleModalStateChanges(currentModals = {}, previousModals = {}) {
        const modals = ['episodeModal', 'ratingModal', 'importExportModal'];
        
        modals.forEach(modalId => {
            const modalName = modalId.replace('Modal', '');
            const isOpen = currentModals[modalName];
            const wasOpen = previousModals[modalName];
            
            if (isOpen !== wasOpen) {
                if (isOpen) {
                    this.showModal(modalId);
                } else {
                    this.hideModal(modalId);
                }
            }
        });
    }

    handleLoadingState(loading) {
        // You could show/hide a global loading indicator here
        if (loading) {
            document.body.style.cursor = 'wait';
        } else {
            document.body.style.cursor = 'default';
        }
    }

    renderMovieList(movies, filters = {}) {
        const container = document.getElementById('movieListContainer');
        
        if (!container) {
            console.error('Movie list container not found!');
            return;
        }

        this.performance.batchDOMUpdates(() => {
            if (movies.length === 0) {
                container.innerHTML = this.createEmptyState();
                return;
            }

            const resultsInfo = this.createFilterResultsInfo(movies.length, filters);
            const moviesHTML = movies.map(movie => this.createMovieHTML(movie)).join('');
            
            container.innerHTML = resultsInfo + moviesHTML;
        });
    }

    createMovieHTML(movie) {
        const watchedEpisodesCount = movie.type === 'tv' ? 
            movie.watchedEpisodes.filter(ep => ep.watched).length : 0;
        const totalEpisodesCount = movie.type === 'tv' ? 
            movie.watchedEpisodes.length : 0;
        const progressPercent = totalEpisodesCount > 0 ? 
            Math.round((watchedEpisodesCount / totalEpisodesCount) * 100) : 0;

        const hasRating = movie.userRating && movie.userRating > 0;
        const ratingStars = '⭐'.repeat(Math.round(movie.userRating / 2));

        // FIXED: Clean poster HTML without broken onerror attribute
        let posterHTML = '<div class="no-poster">No Image</div>';
        if (movie.tmdb_data?.poster) {
            posterHTML = `<img src="${movie.tmdb_data.poster}" alt="${movie.title}" />`;
        }

        // LOAD META DATA FROM TMDB DATA
        let metaHTML = '<div class="meta-unavailable">Details unavailable</div>';
        if (movie.tmdb_data) {
            const year = movie.tmdb_data.year || movie.year || 'Unknown';
            const rating = movie.tmdb_data.rating ? `⭐ ${movie.tmdb_data.rating}` : '';
            const genres = movie.tmdb_data.genres || [];
            
            metaHTML = `
                <div class="movie-year">${year}</div>
                ${rating ? `<div class="movie-rating">${rating}</div>` : ''}
                ${genres.length > 0 ? `<div class="movie-genres">${genres.slice(0, 2).join(', ')}</div>` : ''}
            `;
        }

        return `
            <div class="movie-item" data-movie-id="${movie.id}" data-type="${movie.type}">
                <div class="movie-info">
                    <span class="movie-type">${movie.type === 'tv' ? '📺 TV' : '🎬 Movie'}</span>
                    <div class="movie-poster-small" id="poster-${movie.id}">
                        ${posterHTML}
                    </div>
                    <div class="movie-details-expanded">
                        <div class="movie-title clickable-title" 
                        onclick="window.emergencyNavigateToDetail(${movie.id}, '${movie.type}')">
                        ${this.escapeHTML(movie.title)}
                        ${movie.watched && hasRating ? `
                            <span class="movie-rating-badge">${ratingStars} ${movie.userRating}/10</span>
                        ` : ''}
                    </div>
                        <div class="movie-meta" id="meta-${movie.id}">
                            ${metaHTML}
                        </div>
                        <div class="movie-details">
                            Added: ${movie.addedDate}
                            ${movie.type === 'tv' ? `
                                <div class="episode-progress">
                                    <span class="progress-text">
                                        Progress: ${watchedEpisodesCount}/${totalEpisodesCount} episodes (${progressPercent}%)
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="movie-actions">
                    <button class="toggle-btn ${this.getWatchedStatusClass(movie)}" 
                            data-action="toggle-watched" data-id="${movie.id}">
                        ${this.getWatchedStatusText(movie)}
                    </button>
                    ${movie.watched ? `
                        <button class="rate-btn" data-action="show-rating-modal" data-id="${movie.id}" title="Rate & Review">
                            ${hasRating ? '✏️ Edit' : '⭐ Rate'}
                        </button>
                    ` : ''}
                    <button class="delete-btn" data-action="delete-movie" data-id="${movie.id}">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    getWatchedStatusClass(movie) {
        if (movie.type === 'tv') {
            const watchedEpisodes = movie.watchedEpisodes?.filter(ep => ep.watched).length || 0;
            const totalEpisodes = movie.watchedEpisodes?.length || 0;
            
            if (watchedEpisodes === totalEpisodes && totalEpisodes > 0) {
                return 'watched'; // All episodes watched
            } else if (watchedEpisodes > 0) {
                return 'in-progress'; // Some episodes watched
            }
            return ''; // No episodes watched
        } else {
            return movie.watched ? 'watched' : '';
        }
    }

    getWatchedStatusText(movie) {
        if (movie.type === 'tv') {
            const watchedEpisodes = movie.watchedEpisodes?.filter(ep => ep.watched).length || 0;
            const totalEpisodes = movie.watchedEpisodes?.length || 0;
            
            if (watchedEpisodes === totalEpisodes && totalEpisodes > 0) {
                return 'Watched'; // All episodes watched
            } else if (watchedEpisodes > 0) {
                return `In Progress (${watchedEpisodes}/${totalEpisodes})`; // Some episodes watched
            }
            return 'Mark Watched'; // No episodes watched
        } else {
            return movie.watched ? 'Watched' : 'Mark Watched';
        }
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    createEmptyState() {
        if (!window.stateManager) return '<div>Loading...</div>';
        const state = window.stateManager.getState();
        const filters = state.filters || {};
        
        console.log('Creating empty state for filters:', filters);
        
        let message = '';
        let suggestion = '';
        
        if (filters.watchStatus === 'watchlist') {
            message = 'Your watchlist is empty.';
            suggestion = 'Add some items to your watchlist!';
        } else if (filters.watchStatus === 'watched') {
            message = 'No items marked as watched yet.';
            suggestion = 'Mark some items as watched to see them here!';
        } else if (filters.mediaType === 'movie') {
            message = 'No movies added yet.';
            suggestion = 'Try adding some movies using the search above!';
        } else if (filters.mediaType === 'tv') {
            message = 'No TV shows added yet.';
            suggestion = 'Try adding some TV shows using the search above!';
        } else {
            message = 'No items added yet.';
            suggestion = 'Try adding some movies or TV shows using the search above!';
        }

        return `
            <div class="empty-state">
                <h3>📺</h3>
                <p>${message}</p>
                <div class="suggestions">
                    <p>${suggestion}</p>
                </div>
            </div>
        `;
    }

    createFilterResultsInfo(resultsCount, filters) {
        if (!window.stateManager) return '';
        const totalCount = window.stateManager.getState().movies.length;
        const activeFilters = [];
        
        if (filters.search) {
            activeFilters.push(`Search: "${filters.search}"`);
        }
        if (filters.genre !== 'all') {
            activeFilters.push(`Genre: ${filters.genre}`);
        }

        const filtersHTML = activeFilters.map(filter => {
            const filterType = filter.split(':')[0].toLowerCase().trim();
            return `
                <span class="active-filter-tag">
                    ${filter}
                    <button class="remove-filter" data-action="remove-filter" data-type="${filterType}">×</button>
                </span>
            `;
        }).join('');

        return `
            <div class="filter-results-info">
                <div class="results-count">
                    Showing ${resultsCount} of ${totalCount} items
                    ${activeFilters.length > 0 ? ' (filtered)' : ''}
                </div>
                ${activeFilters.length > 0 ? `
                    <div class="active-filters">
                        ${filtersHTML}
                    </div>
                ` : ''}
            </div>
        `;
    }

    updateStatsDisplay(stats) {
        const totalItems = document.getElementById('totalItems');
        const watchedItems = document.getElementById('watchedItems');
        const tvShows = document.getElementById('tvShows');
        
        if (totalItems) totalItems.textContent = stats.total;
        if (watchedItems) watchedItems.textContent = stats.watched;
        if (tvShows) tvShows.textContent = stats.tvShows;
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            
            const modalName = modalId.replace('Modal', '');
            stateManager.setUIModal(modalName, false);
        }
    }

    closeAllModals() {
        const modals = document.querySelectorAll('.episode-modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
            const modalName = modal.id.replace('Modal', '');
            stateManager.setUIModal(modalName, false);
        });
        document.body.style.overflow = '';
    }

    showTab(tabName) {
        console.log('Switching to tab:', tabName);
        
        if (!window.stateManager || !window.filterManager) return;
        
        // Update state manager with new tab filters
        const newFilters = { ...window.stateManager.getState().filters };
        
        // Set filters based on tab
        switch (tabName) {
            case 'watchlist':
                newFilters.watchStatus = 'watchlist';
                newFilters.mediaType = 'all';
                break;
            case 'watched':
                newFilters.watchStatus = 'watched';
                newFilters.mediaType = 'all';
                break;
            case 'movies':
                newFilters.mediaType = 'movie';
                newFilters.watchStatus = 'all';
                break;
            case 'tv':
                newFilters.mediaType = 'tv';
                newFilters.watchStatus = 'all';
                break;
            default:
                newFilters.mediaType = 'all';
                newFilters.watchStatus = 'all';
        }
        
        stateManager.setFilters(newFilters);
        
        // Update active tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Find and activate the correct tab button
        const tabButton = Array.from(document.querySelectorAll('.tab')).find(btn => {
            const btnTab = btn.dataset.tab || btn.textContent.toLowerCase().replace(' ', '');
            return btnTab === tabName.toLowerCase();
        });
        
        if (tabButton) {
            tabButton.classList.add('active');
        }
        
        // Refresh the movie display
        filterManager.displayFilteredMovies();
        window.filterManager.displayFilteredMovies();
    }

    toggleEpisodeInputs() {
        const type = document.getElementById('mediaType')?.value;
        const episodeInputs = document.getElementById('episodeInputs');
        
        if (!type || !episodeInputs) return;
        
        episodeInputs.style.display = type === 'tv' ? 'flex' : 'none';
    }

    // In UIManager.js - FIXED VERSION
    showNotification(message, type = 'info') {
        // DON'T call ErrorHandler here - that creates a circular dependency
        // ErrorHandler.showUserNotification(message, type); // REMOVE THIS LINE
        
        // Instead, handle the notification directly:
        try {
            // Your existing notification UI code here
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.remove()">×</button>
            `;
            
            // Add styles and positioning
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${this.getNotificationColor(type)};
                color: white;
                padding: 12px 20px;
                border-radius: 4px;
                z-index: 10000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                max-width: 300px;
            `;
            
            document.body.appendChild(notification);
            
            // Auto-remove after 3 seconds
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 3000);
            
        } catch (error) {
            // If UI notification fails, use console as fallback
            console.log(`Notification (${type}): ${message}`);
        }
    }

    getNotificationColor(type) {
        const colors = {
            'success': '#4CAF50',
            'error': '#f44336',
            'warning': '#ff9800',
            'info': '#2196F3'
        };
        return colors[type] || colors.info;
    }
}