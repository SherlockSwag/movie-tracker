// episodeManager.js
class EpisodeManager {
    constructor() {
        this.currentEditingShow = null;
        this.currentSeasonFilter = 1;
        this.performance = new PerformanceOptimizer();
    }

    openEpisodeManager(movieId) {
        this.currentEditingShow = dataManager.getMovieById(movieId);
        if (this.currentEditingShow) {
            this.currentSeasonFilter = 1;
            this.updateEpisodeModal();
            stateManager.setUIModal('episode', true);
        }
    }

    updateEpisodeModal() {
        if (!this.currentEditingShow) return;
        
        const content = document.getElementById('episodeModalContent');
        if (!content) return;
        
        const seasons = this.getUniqueSeasons();
        const filteredEpisodes = this.getFilteredEpisodes();
        const stats = this.calculateEpisodeStats();
        
        content.innerHTML = this.createEpisodeModalHTML(seasons, filteredEpisodes, stats);
    }

    getUniqueSeasons() {
        if (!this.currentEditingShow?.watchedEpisodes) return [1];
        return [...new Set(this.currentEditingShow.watchedEpisodes.map(ep => ep.season))].sort((a, b) => a - b);
    }

    getFilteredEpisodes() {
        if (!this.currentEditingShow?.watchedEpisodes) return [];
        return this.currentEditingShow.watchedEpisodes
            .filter(ep => ep.season === this.currentSeasonFilter)
            .sort((a, b) => a.episode - b.episode);
    }

    calculateEpisodeStats() {
        const allEpisodes = this.currentEditingShow?.watchedEpisodes || [];
        const watchedCount = allEpisodes.filter(ep => ep.watched).length;
        const totalCount = allEpisodes.length;
        const progressPercent = totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0;

        const seasonEpisodes = this.getFilteredEpisodes();
        const seasonWatchedCount = seasonEpisodes.filter(ep => ep.watched).length;
        const seasonTotalCount = seasonEpisodes.length;
        const seasonProgressPercent = seasonTotalCount > 0 ? Math.round((seasonWatchedCount / seasonTotalCount) * 100) : 0;

        return {
            watchedCount,
            totalCount,
            progressPercent,
            seasonWatchedCount,
            seasonTotalCount,
            seasonProgressPercent
        };
    }

    createEpisodeModalHTML(seasons, filteredEpisodes, stats) {
        return `
            <h2>${this.escapeHTML(this.currentEditingShow.title)} - Episode Manager</h2>
            <span class="close-modal" data-action="close-modal" data-modal="episodeModal">&times;</span>
            
            <div class="episode-stats">
                <div class="global-progress">
                    <div class="progress-text">Overall Progress: ${stats.watchedCount}/${stats.totalCount} episodes (${stats.progressPercent}%)</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${stats.progressPercent}%"></div>
                    </div>
                </div>
                <div class="season-progress">
                    <div class="progress-text">Season ${this.currentSeasonFilter}: ${stats.seasonWatchedCount}/${stats.seasonTotalCount} episodes (${stats.seasonProgressPercent}%)</div>
                    <div class="progress-bar">
                        <div class="progress-fill season-fill" style="width: ${stats.seasonProgressPercent}%"></div>
                    </div>
                </div>
            </div>
            
            <div class="season-filter">
                <label>Select Season:</label>
                <select id="seasonSelect" data-action="change-season-filter">
                    ${seasons.map(season => `
                        <option value="${season}" ${this.currentSeasonFilter === season ? 'selected' : ''}>
                            Season ${season}
                        </option>
                    `).join('')}
                </select>
                <div class="season-nav">
                    <button class="nav-btn" data-action="change-season" data-direction="prev" ${this.currentSeasonFilter <= 1 ? 'disabled' : ''}>← Previous</button>
                    <button class="nav-btn" data-action="change-season" data-direction="next" ${this.currentSeasonFilter >= seasons.length ? 'disabled' : ''}>Next →</button>
                </div>
            </div>
            
            <div class="episode-list">
                ${filteredEpisodes.map(ep => this.createEpisodeItemHTML(ep)).join('')}
            </div>
            
            <div class="modal-actions">
                <button data-action="mark-season-watched" data-season="${this.currentSeasonFilter}" class="action-btn mark-season-btn">
                    Mark Season ${this.currentSeasonFilter} Watched
                </button>
                <button data-action="mark-all-watched" class="action-btn mark-all-btn">
                    Mark All Seasons Watched
                </button>
                <button data-action="mark-all-unwatched" class="action-btn mark-none-btn">
                    Mark All Unwatched
                </button>
            </div>
        `;
    }

    createEpisodeItemHTML(episode) {
        return `
            <div class="episode-item ${episode.watched ? 'watched' : ''}">
                <span>
                    S${episode.season.toString().padStart(2, '0')}E${episode.episode.toString().padStart(2, '0')}
                </span>
                <button class="episode-toggle-btn ${episode.watched ? 'watched' : ''}" 
                        data-action="toggle-episode" data-season="${episode.season}" data-episode="${episode.episode}">
                    ${episode.watched ? 'Watched' : 'Mark Watched'}
                </button>
            </div>
        `;
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    changeSeasonFilter(season) {
        this.currentSeasonFilter = parseInt(season);
        this.updateEpisodeModal();
    }

    changeSeason(direction) {
        const seasons = this.getUniqueSeasons();
        const currentIndex = seasons.indexOf(this.currentSeasonFilter);
        let newIndex;
        
        if (direction === 'prev' && currentIndex > 0) {
            newIndex = currentIndex - 1;
        } else if (direction === 'next' && currentIndex < seasons.length - 1) {
            newIndex = currentIndex + 1;
        } else {
            return;
        }
        
        this.currentSeasonFilter = seasons[newIndex];
        this.updateEpisodeModal();
    }

    toggleEpisode(season, episode) {
        if (!this.currentEditingShow) return;
        
        const ep = this.currentEditingShow.watchedEpisodes.find(
            e => e.season === season && e.episode === episode
        );
        
        if (!ep) return;
        
        if (!ep.watched) {
            this.handleMarkEpisodeWatched(season, episode, ep);
        } else {
            ep.watched = false;
            this.handleEpisodeUnwatched();
        }
        
        this.updateShowWatchedStatus();
        this.saveAndRefresh();
    }

    handleMarkEpisodeWatched(season, episode, ep) {
        const allEpisodesInOrder = [...this.currentEditingShow.watchedEpisodes]
            .sort((a, b) => {
                if (a.season !== b.season) return a.season - b.season;
                return a.episode - b.episode;
            });
        
        const currentEpisodeIndex = allEpisodesInOrder.findIndex(
            e => e.season === season && e.episode === episode
        );
        
        const unwatchedBefore = allEpisodesInOrder
            .slice(0, currentEpisodeIndex)
            .filter(e => !e.watched);
        
        if (unwatchedBefore.length > 0) {
            const episodesToMark = unwatchedBefore.length + 1;
            if (confirm(`You're marking S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')} as watched, but there are ${unwatchedBefore.length} unwatched episodes before this. Do you want to mark all ${episodesToMark} episodes (including all previous seasons) as watched?`)) {
                this.markEpisodesUpTo(currentEpisodeIndex, allEpisodesInOrder);
            } else {
                ep.watched = true;
            }
        } else {
            ep.watched = true;
        }
    }

    handleEpisodeUnwatched() {
        // Check if the show should still be considered watched
        const allWatched = this.currentEditingShow.watchedEpisodes.every(e => e.watched);
        if (!allWatched && this.currentEditingShow.watched) {
            this.currentEditingShow.watched = false;
            // Remove rating and review when show is no longer fully watched
            if (this.currentEditingShow.userRating || this.currentEditingShow.userReview) {
                this.currentEditingShow.userRating = 0;
                this.currentEditingShow.userReview = '';
                uiManager.showNotification('Show marked as unwatched. Rating and review removed.');
            }
        }
    }

    markEpisodesUpTo(index, episodes) {
        for (let i = 0; i <= index; i++) {
            const epToMark = episodes[i];
            const actualEp = this.currentEditingShow.watchedEpisodes.find(
                e => e.season === epToMark.season && e.episode === epToMark.episode
            );
            if (actualEp) {
                actualEp.watched = true;
            }
        }
    }

    markSeasonWatched(season) {
        if (!this.currentEditingShow) return;
        
        this.currentEditingShow.watchedEpisodes.forEach(ep => {
            if (ep.season === season) {
                ep.watched = true;
            }
        });
        
        this.updateShowWatchedStatus();
        this.saveAndRefresh();
    }

    markAllEpisodesWatched() {
        if (!this.currentEditingShow) return;
        
        this.currentEditingShow.watchedEpisodes.forEach(ep => {
            ep.watched = true;
        });
        
        this.currentEditingShow.watched = true;
        this.saveAndRefresh();
    }

    markAllEpisodesUnwatched() {
        if (!this.currentEditingShow) return;
        
        this.currentEditingShow.watchedEpisodes.forEach(ep => {
            ep.watched = false;
        });
        
        this.currentEditingShow.watched = false;
        
        // Remove rating and review when marking all unwatched
        if (this.currentEditingShow.userRating || this.currentEditingShow.userReview) {
            this.currentEditingShow.userRating = 0;
            this.currentEditingShow.userReview = '';
        }
        
        this.saveAndRefresh();
    }

    updateShowWatchedStatus() {
        const allWatched = this.currentEditingShow.watchedEpisodes.every(e => e.watched);
        this.currentEditingShow.watched = allWatched;
    }

    saveAndRefresh() {
        dataManager.saveMovies();
        this.updateEpisodeModal();
        filterManager.displayFilteredMovies();
        
        eventBus.emit('episodes:updated', {
            show: this.currentEditingShow,
            season: this.currentSeasonFilter
        });
    }

    closeEpisodeManager() {
        stateManager.setUIModal('episode', false);
        
        // Check if all episodes are now watched and not rated
        if (this.currentEditingShow && 
            this.currentEditingShow.watched && 
            (!this.currentEditingShow.userRating || this.currentEditingShow.userRating === 0)) {
            
            // Small delay to let the episode modal close
            setTimeout(() => {
                app.showRatingModal(this.currentEditingShow.id);
            }, 500);
        }
        
        this.currentEditingShow = null;
        this.currentSeasonFilter = 1;
    }
}