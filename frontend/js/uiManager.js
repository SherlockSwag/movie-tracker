// uiManager.js
class UIManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Modal close handlers
        document.addEventListener('click', (e) => {
            if (e.target.matches('.close-modal')) {
                const modal = e.target.closest('.episode-modal');
                if (modal) this.hideModal(modal.id);
            }
            
            // Backdrop clicks
            if (e.target.matches('.episode-modal')) {
                this.hideModal(e.target.id);
            }
        });

        // ESC key closes modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.episode-modal').forEach(modal => {
                    if (modal.style.display === 'block') {
                        this.hideModal(modal.id);
                    }
                });
            }
        });
    }

    renderMovieList(movies) {
        const container = document.getElementById('movieListContainer');
        if (!container) return;

        if (movies.length === 0) {
            container.innerHTML = this.createEmptyState();
            return;
        }

        const moviesHTML = movies.map(movie => this.createMovieHTML(movie)).join('');
        container.innerHTML = moviesHTML;
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

        let posterHTML = '<div class="no-poster">No Image</div>';
        if (movie.tmdb_data?.poster) {
            posterHTML = `<img src="${movie.tmdb_data.poster}" alt="${movie.title}" />`;
        }

        let metaHTML = '';
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
            <div class="movie-item" data-movie-id="${movie.id}">
                <div class="movie-info">
                    <span class="movie-type">${movie.type === 'tv' ? '📺 TV' : '🎬 Movie'}</span>
                    <div class="movie-poster-small">
                        ${posterHTML}
                    </div>
                    <div class="movie-details-expanded">
                        <div class="movie-title clickable-title" onclick="app.showDetailPage(${movie.id})">
                            ${this.escapeHTML(movie.title)}
                            ${movie.watched && hasRating ? `
                                <span class="movie-rating-badge">${ratingStars} ${movie.userRating}/10</span>
                            ` : ''}
                        </div>
                        <div class="movie-meta">
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
                    <button class="toggle-btn ${this.getWatchedClass(movie)}" 
                            onclick="app.toggleWatched(${movie.id})">
                        ${this.getWatchedText(movie)}
                    </button>
                    ${movie.watched ? `
                        <button class="rate-btn" onclick="app.showRatingModal(${movie.id})">
                            ${hasRating ? '✏️ Edit' : '⭐ Rate'}
                        </button>
                    ` : ''}
                    <button class="delete-btn" onclick="app.deleteMovie(${movie.id})">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    getWatchedClass(movie) {
        if (movie.type === 'tv') {
            const watchedEpisodes = movie.watchedEpisodes?.filter(ep => ep.watched).length || 0;
            const totalEpisodes = movie.watchedEpisodes?.length || 0;
            
            if (watchedEpisodes === totalEpisodes && totalEpisodes > 0) return 'watched';
            if (watchedEpisodes > 0) return 'in-progress';
        }
        return movie.watched ? 'watched' : '';
    }

    getWatchedText(movie) {
        if (movie.type === 'tv') {
            const watchedEpisodes = movie.watchedEpisodes?.filter(ep => ep.watched).length || 0;
            const totalEpisodes = movie.watchedEpisodes?.length || 0;
            
            if (watchedEpisodes === totalEpisodes && totalEpisodes > 0) return 'Watched';
            if (watchedEpisodes > 0) return `In Progress (${watchedEpisodes}/${totalEpisodes})`;
        }
        return movie.watched ? 'Watched' : 'Mark Watched';
    }

    createEmptyState() {
        const filters = app.currentFilters;
        let message = 'No items found.';
        
        if (filters.watchStatus === 'watchlist') {
            message = 'Your watchlist is empty.';
        } else if (filters.watchStatus === 'watched') {
            message = 'No items marked as watched yet.';
        } else if (filters.mediaType === 'movie') {
            message = 'No movies found.';
        } else if (filters.mediaType === 'tv') {
            message = 'No TV shows found.';
        }

        return `
            <div class="empty-state">
                <h3>📺</h3>
                <p>${message}</p>
                <p>Try adding some items using the search above!</p>
            </div>
        `;
    }

    updateStats(stats) {
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
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;
        
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
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
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

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}