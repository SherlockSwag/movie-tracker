// js/apiClient.js - Replaces dataManager.js
class ApiClient {
    constructor() {
        this.baseURL = CONFIG.API.BASE_URL;
        this.token = localStorage.getItem('authToken');
        this.cache = new Map(); // Local cache for performance
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (response.status === 401) {
                // Unauthorized - clear token and redirect to login
                this.logout();
                throw new Error('Authentication required');
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', endpoint, error);
            throw error;
        }
    }

    // ==================== MOVIES ====================
    
    async loadMovies(filters = {}) {
        try {
            const params = new URLSearchParams(filters);
            const data = await this.request(`/movies?${params}`);
            
            // Cache the movies locally for quick access
            this.movies = data.movies || [];
            return this.movies;
        } catch (error) {
            console.error('Failed to load movies:', error);
            this.movies = [];
            return [];
        }
    }

    async getMovieById(id) {
        try {
            // Check cache first
            const cached = this.movies?.find(m => m.id === Number(id));
            if (cached) return cached;
            
            // Fetch from server
            const movie = await this.request(`/movies/${id}`);
            return movie;
        } catch (error) {
            console.error('Failed to get movie:', error);
            return null;
        }
    }

    async addMovie(movieData) {
        try {
            const newMovie = await this.request('/movies', {
                method: 'POST',
                body: JSON.stringify(movieData)
            });
            
            // Update local cache
            if (this.movies) {
                this.movies.push(newMovie);
            }
            
            return newMovie;
        } catch (error) {
            console.error('Failed to add movie:', error);
            throw error;
        }
    }

    async updateMovie(id, updates) {
        try {
            const updatedMovie = await this.request(`/movies/${id}`, {
                method: 'PUT',
                body: JSON.stringify(updates)
            });
            
            // Update local cache
            if (this.movies) {
                const index = this.movies.findIndex(m => m.id === Number(id));
                if (index !== -1) {
                    this.movies[index] = updatedMovie;
                }
            }
            
            return updatedMovie;
        } catch (error) {
            console.error('Failed to update movie:', error);
            throw error;
        }
    }

    async deleteMovie(id) {
        try {
            await this.request(`/movies/${id}`, {
                method: 'DELETE'
            });
            
            // Update local cache
            if (this.movies) {
                this.movies = this.movies.filter(m => m.id !== Number(id));
            }
            
            return true;
        } catch (error) {
            console.error('Failed to delete movie:', error);
            throw error;
        }
    }

    async toggleWatched(id) {
        try {
            const movie = await this.request(`/movies/${id}/toggle-watched`, {
                method: 'POST'
            });
            
            // Update local cache
            if (this.movies) {
                const index = this.movies.findIndex(m => m.id === Number(id));
                if (index !== -1) {
                    this.movies[index] = movie;
                }
            }
            
            return movie;
        } catch (error) {
            console.error('Failed to toggle watched:', error);
            throw error;
        }
    }

    async updateEpisodes(id, episodes) {
        try {
            const movie = await this.request(`/movies/${id}/episodes`, {
                method: 'PUT',
                body: JSON.stringify({ episodes })
            });
            
            // Update local cache
            if (this.movies) {
                const index = this.movies.findIndex(m => m.id === Number(id));
                if (index !== -1) {
                    this.movies[index] = movie;
                }
            }
            
            return movie;
        } catch (error) {
            console.error('Failed to update episodes:', error);
            throw error;
        }
    }

    // ==================== SEARCH & STATS ====================
    
    async searchMovies(query) {
        try {
            const data = await this.request(`/movies/search?q=${encodeURIComponent(query)}`);
            return data.movies || [];
        } catch (error) {
            console.error('Search failed:', error);
            return [];
        }
    }

    async getStats() {
        try {
            return await this.request('/movies/stats');
        } catch (error) {
            console.error('Failed to get stats:', error);
            return {
                total: 0,
                movies: 0,
                tvShows: 0,
                watched: 0
            };
        }
    }

    // ==================== AUTHENTICATION ====================
    
    async login(email, password) {
        try {
            const response = await this.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            
            if (response.token) {
                this.token = response.token;
                localStorage.setItem('authToken', response.token);
            }
            
            return response;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    async register(email, password, name) {
        try {
            const response = await this.request('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ email, password, name })
            });
            
            if (response.token) {
                this.token = response.token;
                localStorage.setItem('authToken', response.token);
            }
            
            return response;
        } catch (error) {
            console.error('Registration failed:', error);
            throw error;
        }
    }

    logout() {
        this.token = null;
        localStorage.removeItem('authToken');
        this.movies = [];
        window.location.href = '/login.html'; // Redirect to login page
    }

    isAuthenticated() {
        return !!this.token;
    }

    // ==================== EXPORT/IMPORT ====================
    
    async exportData() {
        try {
            return await this.request('/movies/export');
        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        }
    }

    async importData(data) {
        try {
            const result = await this.request('/movies/import', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            // Reload movies after import
            await this.loadMovies();
            
            return result;
        } catch (error) {
            console.error('Import failed:', error);
            throw error;
        }
    }

    // ==================== HELPER METHODS (for compatibility) ====================
    
    // These methods work with the cached movies array
    // They maintain compatibility with your existing code
    
    saveMovies() {
        // This method now does nothing since data is saved on the server
        // But we keep it for compatibility with existing code
        console.log('Note: Movies are automatically saved to server');
    }

    initializeEpisodes(tvShow) {
        // Keep this method for creating episode structure before sending to server
        const episodes = [];
        
        if (tvShow.tmdb_data?.seasons_data && tvShow.tmdb_data.seasons_data.length > 0) {
            tvShow.tmdb_data.seasons_data.forEach(seasonData => {
                if (seasonData.season_number === 0) return;
                
                if (seasonData.episodes && Array.isArray(seasonData.episodes)) {
                    seasonData.episodes.forEach(episode => {
                        episodes.push({
                            season: seasonData.season_number,
                            episode: episode.episode_number,
                            watched: false,
                            episodeId: `${seasonData.season_number}-${episode.episode_number}`
                        });
                    });
                }
            });
        } else {
            const seasons = tvShow.totalSeasons || 1;
            const totalEpisodes = tvShow.totalEpisodes || seasons * 10;
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
        
        return episodes;
    }
}