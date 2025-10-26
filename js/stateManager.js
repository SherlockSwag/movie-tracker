// stateManager.js
class StateManager {
    constructor(initialMovies = []) {
        console.log('StateManager: Initializing with', initialMovies.length, 'movies');
        
        this.state = {
            movies: initialMovies, // Use the provided movies
            filters: {
                search: '',
                genre: 'all',
                sortBy: 'addedDate',
                mediaType: 'all',
                watchStatus: 'all'
            },
            stats: {
                total: initialMovies.length, // Calculate from initial movies
                watched: initialMovies.filter(m => m.watched).length,
                movies: initialMovies.filter(m => m.type === 'movie').length,
                tvShows: initialMovies.filter(m => m.type === 'tv').length
            },
            ui: {
                loading: false,
                currentTab: 'all',
                modals: {
                    episode: false,
                    rating: false,
                    itemDetails: false,
                    importExport: false
                }
            }
        };
        this.subscribers = new Set();
        this.previousState = null;
        
        console.log('StateManager: Initial stats calculated', this.state.stats);
    }

    setState(updates) {
        if (this.batchUpdate) {
            this.batchedUpdates = this.deepMerge(this.batchedUpdates, updates);
            return;
        }
        
        this.previousState = { ...this.state };
        this.state = this.deepMerge(this.state, updates);
        this.notifySubscribers();
    }

    batchUpdates(callback) {
        this.batchUpdate = true;
        this.batchedUpdates = {};
        
        try {
            callback();
            if (Object.keys(this.batchedUpdates).length > 0) {
                this.setState(this.batchedUpdates);
            }
        } finally {
            this.batchUpdate = false;
            this.batchedUpdates = {};
        }
    }

    deepMerge(target, source) {
        const output = { ...target };
        
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        output[key] = source[key];
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    output[key] = source[key];
                }
            });
        }
        
        return output;
    }

    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    notifySubscribers() {
        this.subscribers.forEach(callback => {
            try {
                callback(this.state, this.previousState);
            } catch (error) {
                console.error('Error in state subscriber:', error);
            }
        });
    }

    // Specific state actions
    setMovies(movies) {
        this.setState({ movies });
        this.updateStats(movies);
    }

    setFilters(filters) {
        this.setState({ filters: { ...this.state.filters, ...filters } });
    }

    setUIModal(modal, isOpen) {
        const modals = { ...this.state.ui.modals, [modal]: isOpen };
        this.setState({ ui: { ...this.state.ui, modals } });
    }

    setLoading(loading) {
        this.setState({ ui: { ...this.state.ui, loading } });
    }

    setCurrentTab(tab) {
        this.setState({ ui: { ...this.state.ui, currentTab: tab } });
    }

    updateStats(movies = this.state.movies) {
        const stats = {
            total: movies.length,
            movies: movies.filter(m => m.type === 'movie').length,
            tvShows: movies.filter(m => m.type === 'tv').length,
            watched: movies.filter(m => m.watched).length
        };
        this.setState({ stats });
    }

    getState() {
        return this.state;
    }

    getPreviousState() {
        return this.previousState;
    }
}