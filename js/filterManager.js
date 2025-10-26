// filterManager.js
class FilterManager {
    constructor() {
        this.currentFilters = {
            search: '',
            genre: 'all',
            sortBy: 'addedDate'
        };
        this.performance = new PerformanceOptimizer();
        this.setupFilterEvents();
        this.loadSavedFilters();
        
        // Subscribe to state changes - use window.stateManager
        if (window.stateManager) {
            window.stateManager.subscribe((state) => {
                if (state.filters && JSON.stringify(state.filters) !== JSON.stringify(this.currentFilters)) {
                    this.currentFilters = { ...state.filters };
                }
            });
        }
    }

    setupFilterEvents() {
        // Use event delegation for dynamic elements
        document.addEventListener('change', (e) => {
            if (e.target.matches('#genreFilter, #sortBy')) {
                this.performance.debounce('filter-change', () => {
                    this.applyFilters();
                }, 200);
            }
        });

        // Real-time search with debouncing
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.performance.debounce('search-input', () => {
                    this.applyFilters();
                });
            });
        }

          // New: Dual filter button clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('.filter-btn')) {
            const filterType = e.target.dataset.filter;
            const filterValue = e.target.dataset.value;
            
            this.handleFilterButtonClick(filterType, filterValue);
            }
        });
    }

    handleFilterButtonClick(filterType, filterValue) {
        console.log('Filter button clicked:', filterType, filterValue);
        
        // Update active button states
        document.querySelectorAll(`[data-filter="${filterType}"]`).forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Update filters
        this.currentFilters[filterType] = filterValue;
        console.log('Updated filters:', this.currentFilters);
            
        // Use window.stateManager
        window.stateManager.setFilters(this.currentFilters);
        
        // Apply filters
        this.performance.debounce('filter-change', () => {
            this.applyFilters();
        }, 200);
    }

    applyFilters() {
        this.updateFiltersFromUI();
        this.saveFilters();
        this.displayFilteredMovies();
    }

    updateFiltersFromUI() {
        const searchInput = document.getElementById('globalSearch');
        const genreSelect = document.getElementById('genreFilter');
        const sortSelect = document.getElementById('sortBy');
        
        const newFilters = {
            search: searchInput ? searchInput.value.toLowerCase().trim() : '',
            genre: genreSelect ? genreSelect.value : 'all',
            sortBy: sortSelect ? sortSelect.value : 'addedDate'
        };
        
        if (JSON.stringify(newFilters) !== JSON.stringify(this.currentFilters)) {
            this.currentFilters = newFilters;
            stateManager.setFilters(newFilters);
        }
    }

    displayFilteredMovies() {
        const filteredMovies = this.getFilteredMovies();
        
        // Use window.uiManager and the correct method name
        if (window.uiManager) {
            window.uiManager.renderMovieList(filteredMovies, this.currentFilters);
        } else {
            console.error('uiManager not available');
            // Fallback rendering
            this.renderBasicMovieList(filteredMovies);
        }
        
        // Load TMDB data for displayed items
        if (filteredMovies.length > 0 && window.tmdbService) {
            window.tmdbService.loadTMDBDataForItems(filteredMovies);
        }
        
        if (window.eventBus) {
            window.eventBus.emit('filters:applied', {
                filters: this.currentFilters,
                resultsCount: filteredMovies.length
            });
        }

        console.log('FilterManager: Displaying', filteredMovies.length, 'movies');
        console.log('UIManager available:', !!window.uiManager);
        console.log('UIManager render method:', window.uiManager?.renderMovieList);
    }

    // Add fallback rendering
    renderBasicMovieList(movies) {
        const container = document.getElementById('movieListContainer');
        if (!container) return;
        
        if (movies.length === 0) {
            container.innerHTML = '<div class="empty-state">No movies found</div>';
            return;
        }
        
        const moviesHTML = movies.map(movie => {
            // Simple rendering without TMDB data
            const year = movie.year || 'Unknown';
            const type = movie.type === 'tv' ? '📺 TV' : '🎬 Movie';
            
            return `
                <div class="movie-item" data-movie-id="${movie.id}">
                    <div class="movie-info">
                        <span class="movie-type">${type}</span>
                        <div class="movie-poster-small">
                            <div class="no-poster">No Image</div>
                        </div>
                        <div class="movie-details-expanded">
                            <div class="movie-title">${movie.title}</div>
                            <div class="movie-meta">
                                <div class="movie-year">${year}</div>
                            </div>
                            <div class="movie-details">
                                Added: ${movie.addedDate}
                            </div>
                        </div>
                    </div>
                    <div class="movie-actions">
                        <button class="toggle-btn ${movie.watched ? 'watched' : ''}" 
                                data-action="toggle-watched" data-id="${movie.id}">
                            ${movie.watched ? 'Watched' : 'Mark Watched'}
                        </button>
                        <button class="delete-btn" data-action="delete-movie" data-id="${movie.id}">
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = moviesHTML;
    }

    getFilteredMovies() {
        // Use window.stateManager instead of stateManager
        const state = window.stateManager.getState();
        let movies = [...state.movies];
        
        console.log('=== GET FILTERED MOVIES START ===');
        console.log('Total movies in state:', movies.length);
        
        if (movies.length === 0) return [];
        
        // Apply tab filter
        movies = this.applyTabFilter(movies);
        console.log('After tab filter:', movies.length);
        
        // Apply search filter - use window.dataManager
        if (this.currentFilters.search) {
            movies = window.dataManager.searchMovies(this.currentFilters.search);
            console.log('After search filter:', movies.length);
        }
        
        // Apply genre filter
        if (this.currentFilters.genre !== 'all') {
            movies = movies.filter(movie => this.hasMatchingGenre(movie, this.currentFilters.genre));
            console.log('After genre filter:', movies.length);
        }
        
        // Apply sorting
        const sorted = this.sortMovies(movies, this.currentFilters.sortBy);
        console.log('Final sorted count:', sorted.length);
        console.log('=== GET FILTERED MOVIES END ===');
        
        return sorted;
    }

    applyTabFilter(movies) {
        // Use window.stateManager instead of stateManager
        const state = window.stateManager.getState();
        const filters = state.filters || {};
        
        console.log('=== TAB FILTER DEBUG ===');
        console.log('Current tab filters:', {
            mediaType: filters.mediaType,
            watchStatus: filters.watchStatus
        });
        console.log('Total movies before tab filter:', movies.length);
        
        let filteredMovies = movies.filter(movie => {
            // Media type filter
            const mediaMatch = 
                !filters.mediaType || 
                filters.mediaType === 'all' ||
                (filters.mediaType === 'movie' && movie.type === 'movie') ||
                (filters.mediaType === 'tv' && movie.type === 'tv');
            
            // Watch status filter  
            const statusMatch =
                !filters.watchStatus ||
                filters.watchStatus === 'all' ||
                (filters.watchStatus === 'watchlist' && !movie.watched) ||
                (filters.watchStatus === 'watched' && movie.watched);
            
            const matches = mediaMatch && statusMatch;
            
            if (!matches) {
                console.log(`✗ Filtered out: ${movie.title} - Type: ${movie.type}, Watched: ${movie.watched}, MediaMatch: ${mediaMatch}, StatusMatch: ${statusMatch}`);
            }
            
            return matches;
        });
        
        console.log('Movies after tab filter:', filteredMovies.length);
        console.log('Filtered movies:', filteredMovies.map(m => m.title));
        console.log('=== END TAB FILTER DEBUG ===');
        
        return filteredMovies;
    }

    hasMatchingGenre(movie, targetGenre) {
        const target = targetGenre.toLowerCase();
        
        // Check stored genres array
        if (movie.genres && Array.isArray(movie.genres)) {
            const hasGenre = movie.genres.some(genre =>
                genre.toLowerCase().includes(target)
            );
            if (hasGenre) return true;
        }
        
        // Check TMDB data genres
        if (movie.tmdb_data && Array.isArray(movie.tmdb_data.genres)) {
            return movie.tmdb_data.genres.some(genre => 
                genre.toLowerCase().includes(target)
            );
        }
        
        return false;
    }

    sortMovies(movies, sortBy) {
        const sorted = [...movies].sort((a, b) => {
            switch (sortBy) {
                case 'title':
                    return a.title.localeCompare(b.title);
                    
                case 'titleDesc':
                    return b.title.localeCompare(a.title);
                    
                case 'year':
                    const yearA = this.getItemYear(a);
                    const yearB = this.getItemYear(b);
                    return yearB - yearA; // Newest first
                    
                case 'yearOld':
                    const yearAOld = this.getItemYear(a);
                    const yearBOld = this.getItemYear(b);
                    return yearAOld - yearBOld; // Oldest first
                    
                case 'rating':
                    const ratingA = a.userRating || 0;
                    const ratingB = b.userRating || 0;
                    return ratingB - ratingA; // Highest rated first
                    
                case 'addedDate':
                default:
                    return (b.id || 0) - (a.id || 0); // Most recent first
            }
        });
        
        return sorted;
    }

    getItemYear(item) {
        // Try TMDB data first
        if (item.tmdb_data && item.tmdb_data.year) {
            return item.tmdb_data.year;
        }
        
        // Try stored year
        if (item.year) {
            return item.year;
        }
        
        // Extract from title
        const yearMatch = item.title.match(/\((\d{4})\)/);
        if (yearMatch) {
            return parseInt(yearMatch[1]);
        }
        
        return 0;
    }

    clearAllFilters() {
        const searchInput = document.getElementById('globalSearch');
        const genreSelect = document.getElementById('genreFilter');
        const sortSelect = document.getElementById('sortBy');
        
        if (searchInput) searchInput.value = '';
        if (genreSelect) genreSelect.value = 'all';
        if (sortSelect) sortSelect.value = 'addedDate';
        
        this.currentFilters = { 
            search: '', 
            genre: 'all', 
            sortBy: 'addedDate' 
        };
            
        // Use window.stateManager
        window.stateManager.setFilters(this.currentFilters);
        localStorage.removeItem(CONFIG.STORAGE.FILTERS_KEY);
        this.displayFilteredMovies();
        
        // Use window.eventBus
        if (window.eventBus) {
            window.eventBus.emit('filters:cleared');
        }
    }

    removeFilter(filterType) {
        switch (filterType) {
            case 'search':
                const searchInput = document.getElementById('globalSearch');
                if (searchInput) searchInput.value = '';
                break;
            case 'genre':
                const genreSelect = document.getElementById('genreFilter');
                if (genreSelect) genreSelect.value = 'all';
                break;
        }
        this.applyFilters();
    }

    saveFilters() {
        try {
            localStorage.setItem(CONFIG.STORAGE.FILTERS_KEY, JSON.stringify(this.currentFilters));
        } catch (error) {
            console.error('Error saving filters:', error);
        }
    }

    loadSavedFilters() {
        try {
            const savedFilters = localStorage.getItem(CONFIG.STORAGE.FILTERS_KEY);
            if (savedFilters) {
                const parsed = JSON.parse(savedFilters);
                this.currentFilters = {
                    search: parsed.search || '',
                    genre: parsed.genre || 'all',
                    sortBy: parsed.sortBy || 'addedDate'
                };
                
                // Apply to UI
                const searchInput = document.getElementById('globalSearch');
                const genreSelect = document.getElementById('genreFilter');
                const sortSelect = document.getElementById('sortBy');
                
                if (searchInput) searchInput.value = this.currentFilters.search;
                if (genreSelect) genreSelect.value = this.currentFilters.genre;
                if (sortSelect) sortSelect.value = this.currentFilters.sortBy;
                
                // Use window.stateManager
                window.stateManager.setFilters(this.currentFilters);
            }
        } catch (error) {
            console.error('Error loading saved filters:', error);
        }
    }

    getAvailableGenres() {
        // Use window.stateManager
        const movies = window.stateManager.getState().movies;
        const genres = new Set();
        
        movies.forEach(movie => {
            if (movie.genres) {
                movie.genres.forEach(genre => genres.add(genre.toLowerCase()));
            }
            if (movie.tmdb_data?.genres) {
                movie.tmdb_data.genres.forEach(genre => genres.add(genre.name.toLowerCase()));
            }
        });
        
        return Array.from(genres).sort();
    }
}