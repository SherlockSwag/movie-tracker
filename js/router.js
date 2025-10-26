// router.js
class Router {
    constructor() {
        this.routes = {
            '/': 'home',
            '/movie/:id': 'movieDetail', 
            '/tv/:id': 'tvDetail'
        };
        this.currentPath = '/';
        this.initialized = false;
        
        // Immediate initialization - no waiting
        this.init();
    }

    async waitForDependencies() {
        // Quick check - if basic dependencies exist, proceed immediately
        if (window.dataManager && Array.isArray(window.dataManager.movies)) {
            console.log('Router dependencies ready instantly');
            return true;
        }
        
        // Very short wait with quick checks
        for (let i = 0; i < 5; i++) { // Only 5 retries max (500ms total)
            if (window.dataManager && Array.isArray(window.dataManager.movies)) {
                console.log(`Router dependencies ready after ${(i + 1) * 100}ms`);
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.warn('Router proceeding with available dependencies');
        return true; // Always proceed after short wait
    }

    async initialize() {
        if (!this.initialized) {
            console.warn('Router not initialized yet, initializing now...');
            await this.waitForDependencies();
            this.init();
        }
    }

    init() {
        this.initialized = true; // Mark as initialized immediately
        
        // Handle browser back/forward
        window.addEventListener('popstate', () => {
            this.handleRouteChange();
        });

        // Intercept internal link clicks
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[data-internal]');
            if (link) {
                e.preventDefault();
                this.navigate(link.getAttribute('href'));
            }
        });

        // Initial route
        this.handleRouteChange();
        
        console.log('Router initialized immediately');
    }
    
    // Add a method to safely get dataManager
    getDataManager() {
        // Always try to use the global dataManager first
        if (window.dataManager && window.dataManager.movies !== undefined) {
            return window.dataManager;
        }
        
        // If global isn't available, try to get it from app
        if (window.app && window.app.dataManager) {
            return window.app.dataManager;
        }
        
        console.error('CRITICAL: DataManager not available anywhere!');
        
        // Ultimate fallback - try to create a minimal working version
        return {
            getMovieById: (id) => {
                console.error('EMERGENCY: Using broken fallback DataManager for ID:', id);
                return null;
            },
            movies: []
        };
    }

    debugRouteFlow(id, type) {
        console.log('=== ROUTER DEBUG ===');
        console.log('Input ID:', id, 'Type:', typeof id);
        console.log('ID as string:', id.toString());
        console.log('Starts with tmdb-?:', id.toString().startsWith('tmdb-'));
        console.log('TMDB ID if applicable:', id.toString().startsWith('tmdb-') ? parseInt(id.toString().replace('tmdb-', '')) : 'N/A');
        
        const dataManager = this.getDataManager();
        console.log('DataManager available:', !!dataManager);
        console.log('DataManager movies count:', dataManager.movies ? dataManager.movies.length : 'N/A');
        console.log('TMDB Service available:', !!tmdbService);
        
        if (!id.toString().startsWith('tmdb-')) {
            const numericId = parseInt(id);
            console.log('Looking up numeric ID:', numericId);
            if (dataManager && dataManager.getMovieById) {
                const item = dataManager.getMovieById(numericId);
                console.log('DataManager lookup result:', item);
            }
        }
        console.log('==================');
    }

    navigate(path) {
        // Don't navigate if we're already on this path
        if (path === this.currentPath) return;
        
        history.pushState({}, '', path);
        this.handleRouteChange();
        
        // Scroll to top on navigation
        window.scrollTo(0, 0);
    }

    handleRouteChange() {
        this.currentPath = window.location.pathname;
        const match = this.matchRoute(this.currentPath);
        
        if (match) {
            this.showPage(match.page, match.params);
        } else {
            this.show404();
        }
    }

    matchRoute(path) {
        // Handle root path
        if (path === '/') {
            return { page: 'home', params: {} };
        }
        
        // Handle movie and TV detail routes (both collection and TMDB items)
        const movieMatch = path.match(/^\/movie\/(.+)$/);
        if (movieMatch) {
            return { page: 'movieDetail', params: { id: movieMatch[1] } };
        }
        
        const tvMatch = path.match(/^\/tv\/(.+)$/);
        if (tvMatch) {
            return { page: 'tvDetail', params: { id: tvMatch[1] } };
        }
        
        return null;
    }

    showPage(page, params) {
        console.log(`Showing page: ${page}`, params);
        
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => {
            p.style.display = 'none';
        });

        switch (page) {
            case 'home':
                this.showHomePage();
                break;
            case 'movieDetail':
                // FIX: Don't parse the ID - pass it as-is
                this.showMovieDetail(params.id);
                break;
            case 'tvDetail':
                // FIX: Don't parse the ID - pass it as-is
                this.showTVDetail(params.id);
                break;
        }
    }

    showHomePage() {
        const homePage = document.getElementById('homePage');
        if (homePage) {
            homePage.style.display = 'block';
            // Refresh the movie list if needed
            if (filterManager) {
                filterManager.displayFilteredMovies();
            }
        }
    }

    async showMovieDetail(id) {
        // FIX: Pass the ID as-is, don't parse it
        await this.showDetailPage(id, 'movie');
    }

    async showTVDetail(id) {
        // FIX: Pass the ID as-is, don't parse it
        await this.showDetailPage(id, 'tv');
    }

    async showDetailPage(id, type) {
        this.debugRouteFlow(id, type);

        const detailPage = document.getElementById('detailPage');
        if (!detailPage) {
            console.error('Detail page element not found');
            this.navigate('/');
            return;
        }

        detailPage.style.display = 'block';
        
        // Show loading state
        const content = document.getElementById('detailContent');
        if (content) {
            content.innerHTML = `
                <div class="loading-detail">
                    <div class="loading-spinner"></div>
                    <p>Loading ${type === 'movie' ? 'movie' : 'TV show'} details...</p>
                </div>
            `;
        }

        // Check if this is a TMDB item (not in collection)
        const idStr = id.toString();
        console.log('Processing ID:', idStr, 'Type:', type);
        
        if (idStr.startsWith('tmdb-')) {
            const tmdbId = parseInt(idStr.replace('tmdb-', ''));
            console.log('Loading TMDB detail page:', tmdbId, type);
            await this.showTMDBDetailPage(tmdbId, type);
            return;
        }

        // Handle regular collection items
        try {
            const numericId = Number(id); // Use Number instead of parseInt
            const dataManager = this.getDataManager();
            
            console.log('Looking for movie with ID:', numericId);
            console.log('Available movies:', dataManager.movies);
            
            const item = dataManager.getMovieById(numericId);
            
            if (!item) {
                console.error('Item not found. Available IDs:', dataManager.movies.map(m => m.id));
                throw new Error('Item not found in collection');
            }

            console.log('Found item:', item);

            // Enhance with TMDB data if needed
            try {
                if ((!item.tmdb_data || !item.tmdb_data.cast) && item.tmdb_id) {
                    await tmdbService.loadSingleItemTMDBData(item);
                }
            } catch (tmdbError) {
                console.warn('Failed to load TMDB data:', tmdbError);
            }

            this.renderDetailPage(item, type);
            
        } catch (error) {
            console.error('Error loading detail page:', error);
            this.showErrorPage(`Failed to load ${type} details: ${error.message}`);
        }
    }

    // Add method to handle TMDB items not in collection
    async showTMDBDetailPage(tmdbId, type) {
        const content = document.getElementById('detailContent');
        if (!content) return;

        try {
            console.log('Fetching TMDB data for:', tmdbId, type);
            
            let tmdbData;
            if (type === 'movie') {
                tmdbData = await tmdbService.getMovieDetails(tmdbId);
            } else {
                tmdbData = await tmdbService.getTVDetails(tmdbId);
            }
            
            if (!tmdbData) {
                throw new Error('Failed to load details from TMDB');
            }

            console.log('TMDB data loaded:', tmdbData.title || tmdbData.name);
            
            const movieData = type === 'movie' ? 
                tmdbService.formatMovieDataForDisplay(tmdbData) :
                tmdbService.formatTVDataForDisplay(tmdbData);

            // Create temporary item for display
            const tempItem = {
                id: 'tmdb-' + tmdbId,
                tmdb_id: tmdbId,
                type: type,
                title: movieData.title,
                addedDate: 'Not in your collection',
                watched: false,
                watchedEpisodes: type === 'tv' ? [] : undefined,
                userRating: 0,
                userReview: '',
                tmdb_data: movieData
            };

            console.log('Rendering detail page for TMDB item:', tempItem);
            this.renderDetailPage(tempItem, type);
            
        } catch (error) {
            console.error('Error loading TMDB detail page:', error);
            this.showErrorPage(`Failed to load ${type} details from TMDB: ${error.message}`);
        }
    }

    // Add method to update actions for TMDB items
    updateActionsForTMDBItem(tmdbId, type) {
        const actionButtons = document.querySelector('.action-buttons');
        if (actionButtons) {
            actionButtons.innerHTML = `
                <button class="btn-primary" onclick="window.addTMDBItemToCollection(${tmdbId}, '${type}')">
                    ➕ Add to Collection
                </button>
                <button class="btn-secondary" onclick="window.navigateToMovieDetail('', 'home')">
                    ← Back to Collection
                </button>
            `;
        }
        
        // Also update the progress section for TV shows
        const progressSection = document.querySelector('.progress-section');
        if (progressSection && type === 'tv') {
            progressSection.innerHTML = `
                <h3>TV Show Information</h3>
                <p>This show is not yet in your collection. Add it to track episodes!</p>
            `;
        }
    }



    renderDetailPage(item, type) {
        const content = document.getElementById('detailContent');
        if (!content) return;

        content.innerHTML = this.createDetailPageHTML(item, type);
        
        // Load additional data
        this.loadAdditionalData(item, type);
    }

    createDetailPageHTML(item, type) {
        const tmdbData = item.tmdb_data || {};
        const isMovie = type === 'movie';
        
        return `
            <div class="detail-header">
                <button class="back-button" onclick="window.navigateToMovieDetail('', 'home')">
                    ← Back to Collection
                </button>
            </div>

            <div class="detail-content">
                <div class="detail-poster-section">
                    <div class="detail-poster">
                        ${tmdbData.poster ? 
                            `<img src="${tmdbData.poster}" alt="${item.title}" />` :
                            '<div class="no-poster-large">No Image Available</div>'
                        }
                    </div>
                    
                    <div class="detail-actions">
                        ${this.createActionButtons(item)}
                        ${this.createProgressSection(item)}
                    </div>
                </div>

                <div class="detail-info-section">
                    <h1 class="detail-title">${this.escapeHTML(item.title)}</h1>
                    ${this.createMetadataSection(item, tmdbData, isMovie)}
                    ${this.createOverviewSection(tmdbData)}
                    ${this.createCastSection(tmdbData)}
                    ${this.createStreamingSection(tmdbData)}
                    ${this.createSimilarSection(tmdbData, type)}
                </div>
            </div>
        `;
    }

    createActionButtons(item) {
        // Check if this is a TMDB temporary item (not in collection)
        if (item.id && item.id.toString().startsWith('tmdb-')) {
            const tmdbId = item.tmdb_id;
            const type = item.type || 'movie';
            
            return `
                <div class="action-buttons">
                    <button class="btn-primary" onclick="addToCollectionSimple(${tmdbId}, '${type}')">
                        ➕ Add to Collection
                    </button>
                </div>
            `;
        }

        // Regular collection item buttons (unchanged)
        return `
            <div class="action-buttons">
                <button class="btn-primary" data-action="toggle-watched" data-id="${item.id}">
                    ${item.watched ? '✅ Watched' : '👁️ Mark Watched'}
                </button>
                <button class="btn-secondary" data-action="show-rating-modal" data-id="${item.id}">
                    ${item.userRating ? `⭐ ${item.userRating}/10 - Edit` : '⭐ Rate & Review'}
                </button>
                <button class="btn-danger" data-action="delete-movie" data-id="${item.id}">
                    🗑️ Remove
                </button>
            </div>
        `;
    }

    createProgressSection(item) {
        if (item.type !== 'tv') return '';

        // Check if this is a TMDB temporary item
        if (item.id && item.id.toString().startsWith('tmdb-')) {
            return `
                <div class="progress-section">
                    <h3>TV Show Information</h3>
                    <p>This show is not yet in your collection. Add it to track episodes!</p>
                    ${item.tmdb_data?.seasons_data ? `
                        <div class="tmdb-episode-info">
                            <p><strong>TMDB Data Available:</strong> ${item.tmdb_data.total_seasons} seasons, ${item.tmdb_data.total_episodes} episodes</p>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Regular collection item progress section (your existing code)
        const watchedEpisodes = item.watchedEpisodes.filter(ep => ep.watched).length;
        const totalEpisodes = item.watchedEpisodes.length;
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
                <button class="btn-outline" data-action="manage-episodes" data-id="${item.id}">
                    📺 Manage Episodes
                </button>
            </div>
        `;
    }

    createOverviewSection(tmdbData) {
        if (!tmdbData.overview || tmdbData.overview === 'No description available.') return '';
        
        return `
            <section class="detail-section">
                <h2>Synopsis</h2>
                <p class="overview">${this.escapeHTML(tmdbData.overview)}</p>
            </section>
        `;
    }

    createMetadataSection(item, tmdbData, isMovie) {
        const metadata = [];

        if (isMovie && tmdbData.runtime) {
            metadata.push(`<div class="metadata-item">
                <strong>Runtime:</strong> ${Math.floor(tmdbData.runtime / 60)}h ${tmdbData.runtime % 60}m
            </div>`);
        }

        if (!isMovie && tmdbData.total_seasons) {
            metadata.push(`<div class="metadata-item">
                <strong>Runtime:</strong> ${tmdbData.total_seasons} season${tmdbData.total_seasons > 1 ? 's' : ''}
            </div>`);
        }

        if (tmdbData.genres?.length) {
            metadata.push(`<div class="metadata-item">
                <strong>Genre:</strong> ${tmdbData.genres.slice(0, 5).join(', ')}
            </div>`);
        }
        
        if (tmdbData.rating) {
            metadata.push(`<div class="metadata-item">
                <strong>TMDB Rating:</strong> ⭐ ${Math.round(tmdbData.rating * 10) / 10}/10
            </div>`);
        }
        
        // Only show user rating for collection items
        if (item.userRating && !item.id.toString().startsWith('tmdb-')) {
            metadata.push(`<div class="metadata-item">
                <strong>Your Rating:</strong> ⭐ ${item.userRating}/10
            </div>`);
        }
        
        if (isMovie && tmdbData.release_date) {
            metadata.push(`<div class="metadata-item">
                <strong>Release Date:</strong> ${new Date(tmdbData.release_date).toLocaleDateString()}
            </div>`);
        }
        
        if (!isMovie && tmdbData.first_air_date) {
            metadata.push(`<div class="metadata-item">
                <strong>First Air Date:</strong> ${new Date(tmdbData.first_air_date).toLocaleDateString()}
            </div>`);
        }

                // Only show added date for collection items
        if (item.addedDate && !item.id.toString().startsWith('tmdb-')) {
            metadata.push(`<div class="metadata-item">
                <strong>Added to List:</strong> ${item.addedDate}
            </div>`);
        } else if (item.id.toString().startsWith('tmdb-')) {
            metadata.push(`<div class="metadata-item">
                <strong>Added to List:</strong> Not Added to List
            </div>`);
        }
        
        if (!isMovie && tmdbData.status) {
            metadata.push(`<div class="metadata-item">
                <strong>Status:</strong> ${tmdbData.status}
            </div>`);
        }

        if (metadata.length === 0) return '';

        return `
            <section class="detail-section">
                <h2>Details</h2>
                <div class="metadata-grid">
                    ${metadata.join('')}
                </div>
            </section>
        `;
    }

    createCastSection(tmdbData) {
        if (!tmdbData.cast || tmdbData.cast.length === 0) return '';

        const castList = tmdbData.cast.slice(0, 8).map(actor => `
            <div class="cast-member">
                <div class="cast-name">${this.escapeHTML(actor)}</div>
            </div>
        `).join('');

        return `
            <section class="detail-section">
                <h2>Cast</h2>
                <div class="cast-grid">
                    ${castList}
                </div>
            </section>
        `;
    }

    createStreamingSection(tmdbData) {
        return `
            <section class="detail-section">
                <h2>Where to Watch</h2>
                <div class="streaming-placeholder">
                    <p>Loading streaming availability...</p>
                </div>
            </section>
        `;
    }

    createSimilarSection(tmdbData, type) {
        return `
            <section class="detail-section">
                <h2>You Might Also Like</h2>
                <div class="similar-placeholder">
                    <p>Similar recommendations will appear here.</p>
                </div>
            </section>
        `;
    }

    async loadAdditionalData(item, type) {
        try {
            // Load streaming availability if the method exists
            if (item.tmdb_id && tmdbService.getStreamingAvailability) {
                const streamingData = await tmdbService.getStreamingAvailability(item.tmdb_id, type);
                this.updateStreamingSection(streamingData);
            } else {
                console.warn('getStreamingAvailability method not available');
                this.updateStreamingSection({}); // Show unavailable message
            }

            // Load similar content if the method exists
            if (item.tmdb_id) {
                this.loadSimilarContent(item.tmdb_id, type);
            }
        } catch (error) {
            console.error('Error loading additional data:', error);
            this.updateStreamingSection({}); // Show unavailable message on error
        }
    }

    updateStreamingSection(streamingData) {
        const streamingSection = document.querySelector('.streaming-placeholder');
        if (!streamingSection) return;

        if (streamingData.flatrate && streamingData.flatrate.length > 0) {
            const streamingHTML = streamingData.flatrate.slice(0, 5).map(provider => `
                <span class="streaming-badge" style="background: ${this.getServiceColor(provider.provider_name)}">
                    ${this.getServiceIcon(provider.provider_name)} 
                    ${provider.provider_name}
                </span>
            `).join('');
            
            streamingSection.innerHTML = `
                <div class="streaming-available">
                    <p>Available on:</p>
                    <div class="streaming-badges">
                        ${streamingHTML}
                    </div>
                </div>
            `;
        } else {
            streamingSection.innerHTML = `
                <div class="streaming-unavailable">
                    <p>Not currently available for streaming subscription</p>
                    <small>Check individual platforms for rental/purchase options</small>
                </div>
            `;
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

    getServiceIcon(serviceName) {
        const icons = {
            'Netflix': '🎬',
            'Disney Plus': '🏰',
            'Amazon Prime Video': '📦',
            'HBO Max': '📺',
            'Hulu': '🟩',
            'Apple TV Plus': '🍎',
            'Paramount Plus': '🔷'
        };
        return icons[serviceName] || '📺';
    }

    async loadSimilarContent(tmdbId, type) {
        // Load similar movies/TV shows from TMDB
        try {
            const response = await fetch(
                `${CONFIG.TMDB.BASE_URL}/${type}/${tmdbId}/similar?api_key=${CONFIG.TMDB.API_KEY}`
            );
            const data = await response.json();
            this.updateSimilarSection(data.results?.slice(0, 6) || []);
        } catch (error) {
            console.error('Failed to load similar content:', error);
        }
    }

    updateSimilarSection(similarItems) {
        const similarSection = document.querySelector('.similar-placeholder');
        if (similarSection && similarItems.length > 0) {
            // Update with actual similar items
        }
    }

    showErrorPage(message) {
        const content = document.getElementById('detailContent');
        if (content) {
            const dataManager = this.getDataManager();
            content.innerHTML = `
                <div class="error-detail">
                    <h2>😕 Something went wrong</h2>
                    <p>${message}</p>
                    <div class="debug-info">
                        <p><strong>Debug Information:</strong></p>
                        <p>Total movies in collection: ${dataManager.movies ? dataManager.movies.length : 0}</p>
                        <p>Available IDs: ${dataManager.movies ? dataManager.movies.map(m => m.id).join(', ') : 'none'}</p>
                    </div>
                    <button onclick="window.navigateToMovieDetail('', 'home')" class="btn-primary">
                        Back to Collection
                    </button>
                    <button onclick="location.reload()" class="btn-secondary">
                        Refresh Page
                    </button>
                </div>
            `;
        }
    }

    show404() {
        this.navigate('/'); // Redirect to home for unknown routes
    }

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Global router instance
let router;