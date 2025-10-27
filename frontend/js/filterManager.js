// filterManager.js
class FilterManager {
    constructor() {
        this.currentFilters = {
            search: '',
            genre: 'all',
            sortBy: 'addedDate',
            mediaType: 'all',
            watchStatus: 'all'
        };
        this.debounceTimer = null;
        this.setupFilterEvents();
        this.loadSavedFilters();
    }

    setupFilterEvents() {
        // Search input
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => this.applyFilters(), CONFIG.APP.DEBOUNCE_DELAY);
            });
        }

        // Genre and sort dropdowns
        document.addEventListener('change', (e) => {
            if (e.target.matches('#genreFilter, #sortBy')) {
                this.applyFilters();
            }
        });

        // Filter buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('.filter-btn')) {
                const filterType = e.target.dataset.filter;
                const filterValue = e.target.dataset.value;
                
                // Update active button states
                document.querySelectorAll(`[data-filter="${filterType}"]`).forEach(btn => {
                    btn.classList.remove('active');
                });
                e.target.classList.add('active');
                
                this.currentFilters[filterType] = filterValue;
                this.applyFilters();
            }
        });
    }

    applyFilters() {
        this.updateFiltersFromUI();
        this.saveFilters();
        const filteredMovies = this.getFilteredMovies();
        uiManager.renderMovieList(filteredMovies);
        
        // Load TMDB data for visible items
        tmdbService.loadDataForItems(filteredMovies);
    }

    updateFiltersFromUI() {
        const searchInput = document.getElementById('globalSearch');
        const genreSelect = document.getElementById('genreFilter');
        const sortSelect = document.getElementById('sortBy');
        
        this.currentFilters.search = searchInput ? searchInput.value.toLowerCase().trim() : '';
        this.currentFilters.genre = genreSelect ? genreSelect.value : 'all';
        this.currentFilters.sortBy = sortSelect ? sortSelect.value : 'addedDate';
    }

    getFilteredMovies() {
        let movies = [...dataManager.movies];
        
        // Apply media type filter
        if (this.currentFilters.mediaType !== 'all') {
            movies = movies.filter(m => m.type === this.currentFilters.mediaType);
        }
        
        // Apply watch status filter
        if (this.currentFilters.watchStatus === 'watchlist') {
            movies = movies.filter(m => !m.watched);
        } else if (this.currentFilters.watchStatus === 'watched') {
            movies = movies.filter(m => m.watched);
        }
        
        // Apply search filter
        if (this.currentFilters.search) {
            movies = dataManager.searchMovies(this.currentFilters.search);
        }
        
        // Apply genre filter
        if (this.currentFilters.genre !== 'all') {
            const targetGenre = this.currentFilters.genre.toLowerCase();
            movies = movies.filter(movie => {
                if (movie.genres && Array.isArray(movie.genres)) {
                    return movie.genres.some(g => g.toLowerCase().includes(targetGenre));
                }
                if (movie.tmdb_data?.genres) {
                    return movie.tmdb_data.genres.some(g => g.toLowerCase().includes(targetGenre));
                }
                return false;
            });
        }
        
        // Apply sorting
        return this.sortMovies(movies, this.currentFilters.sortBy);
    }

    sortMovies(movies, sortBy) {
        return [...movies].sort((a, b) => {
            switch (sortBy) {
                case 'title':
                    return a.title.localeCompare(b.title);
                    
                case 'titleDesc':
                    return b.title.localeCompare(a.title);
                    
                case 'year':
                    return this.getYear(b) - this.getYear(a);
                    
                case 'yearOld':
                    return this.getYear(a) - this.getYear(b);
                    
                case 'rating':
                    return (b.userRating || 0) - (a.userRating || 0);
                    
                case 'addedDate':
                default:
                    return (b.id || 0) - (a.id || 0);
            }
        });
    }

    getYear(item) {
        if (item.tmdb_data?.year) return item.tmdb_data.year;
        if (item.year) return item.year;
        
        const yearMatch = item.title.match(/\((\d{4})\)/);
        return yearMatch ? parseInt(yearMatch[1]) : 0;
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
            sortBy: 'addedDate',
            mediaType: 'all',
            watchStatus: 'all'
        };
        
        // Reset filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.value === 'all') {
                btn.classList.add('active');
            }
        });
        
        localStorage.removeItem(CONFIG.STORAGE.FILTERS_KEY);
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
            const saved = localStorage.getItem(CONFIG.STORAGE.FILTERS_KEY);
            if (saved) {
                this.currentFilters = JSON.parse(saved);
                
                // Apply to UI
                const searchInput = document.getElementById('globalSearch');
                const genreSelect = document.getElementById('genreFilter');
                const sortSelect = document.getElementById('sortBy');
                
                if (searchInput) searchInput.value = this.currentFilters.search;
                if (genreSelect) genreSelect.value = this.currentFilters.genre;
                if (sortSelect) sortSelect.value = this.currentFilters.sortBy;
                
                // Update filter buttons
                document.querySelectorAll('.filter-btn').forEach(btn => {
                    const filterType = btn.dataset.filter;
                    const filterValue = btn.dataset.value;
                    
                    if (this.currentFilters[filterType] === filterValue) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }
        } catch (error) {
            console.error('Error loading saved filters:', error);
        }
    }
}