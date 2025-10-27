// episodeManager.js
class EpisodeManager {
    constructor() {
        this.currentShow = null;
        this.currentSeason = 1;
    }

    openEpisodeManager(movieId) {
        this.currentShow = dataManager.getMovieById(movieId);
        if (!this.currentShow) return;
        
        this.currentSeason = 1;
        this.updateModal();
        uiManager.showModal('episodeModal');
    }

    updateModal() {
        const content = document.getElementById('episodeModalContent');
        if (!content || !this.currentShow) return;
        
        const seasons = this.getSeasons();
        const episodes = this.getEpisodesForSeason(this.currentSeason);
        const stats = this.calculateStats();
        
        content.innerHTML = `
            <h2>${this.escapeHTML(this.currentShow.title)} - Episode Manager</h2>
            <span class="close-modal" onclick="uiManager.hideModal('episodeModal')">&times;</span>
            
            <div class="episode-stats">
                <div class="global-progress">
                    <div class="progress-text">Overall: ${stats.watchedCount}/${stats.totalCount} episodes (${stats.progressPercent}%)</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${stats.progressPercent}%"></div>
                    </div>
                </div>
                <div class="season-progress">
                    <div class="progress-text">Season ${this.currentSeason}: ${stats.seasonWatched}/${stats.seasonTotal} episodes (${stats.seasonPercent}%)</div>
                    <div class="progress-bar">
                        <div class="progress-fill season-fill" style="width: ${stats.seasonPercent}%"></div>
                    </div>
                </div>
            </div>
            
            <div class="season-filter">
                <label>Season:</label>
                <select onchange="episodeManager.changeSeason(parseInt(this.value))">
                    ${seasons.map(s => `
                        <option value="${s}" ${this.currentSeason === s ? 'selected' : ''}>
                            Season ${s}
                        </option>
                    `).join('')}
                </select>
                <div class="season-nav">
                    <button class="nav-btn" onclick="episodeManager.prevSeason()" ${this.currentSeason <= 1 ? 'disabled' : ''}>← Prev</button>
                    <button class="nav-btn" onclick="episodeManager.nextSeason()" ${this.currentSeason >= seasons.length ? 'disabled' : ''}>Next →</button>
                </div>
            </div>
            
            <div class="episode-list">
                ${episodes.map(ep => `
                    <div class="episode-item ${ep.watched ? 'watched' : ''}">
                        <span>S${ep.season.toString().padStart(2, '0')}E${ep.episode.toString().padStart(2, '0')}</span>
                        <button class="episode-toggle-btn ${ep.watched ? 'watched' : ''}" 
                                onclick="episodeManager.toggleEpisode(${ep.season}, ${ep.episode})">
                            ${ep.watched ? 'Watched' : 'Mark Watched'}
                        </button>
                    </div>
                `).join('')}
            </div>
            
            <div class="modal-actions">
                <button class="action-btn mark-season-btn" onclick="episodeManager.markSeasonWatched(${this.currentSeason})">
                    Mark Season ${this.currentSeason} Watched
                </button>
                <button class="action-btn mark-all-btn" onclick="episodeManager.markAllWatched()">
                    Mark All Watched
                </button>
                <button class="action-btn mark-none-btn" onclick="episodeManager.markAllUnwatched()">
                    Mark All Unwatched
                </button>
            </div>
        `;
    }

    getSeasons() {
        if (!this.currentShow?.watchedEpisodes) return [1];
        return [...new Set(this.currentShow.watchedEpisodes.map(ep => ep.season))].sort((a, b) => a - b);
    }

    getEpisodesForSeason(season) {
        if (!this.currentShow?.watchedEpisodes) return [];
        return this.currentShow.watchedEpisodes
            .filter(ep => ep.season === season)
            .sort((a, b) => a.episode - b.episode);
    }

    calculateStats() {
        const all = this.currentShow?.watchedEpisodes || [];
        const watchedCount = all.filter(ep => ep.watched).length;
        const totalCount = all.length;
        const progressPercent = totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0;

        const seasonEps = this.getEpisodesForSeason(this.currentSeason);
        const seasonWatched = seasonEps.filter(ep => ep.watched).length;
        const seasonTotal = seasonEps.length;
        const seasonPercent = seasonTotal > 0 ? Math.round((seasonWatched / seasonTotal) * 100) : 0;

        return {
            watchedCount,
            totalCount,
            progressPercent,
            seasonWatched,
            seasonTotal,
            seasonPercent
        };
    }

    changeSeason(season) {
        this.currentSeason = season;
        this.updateModal();
    }

    prevSeason() {
        if (this.currentSeason > 1) {
            this.currentSeason--;
            this.updateModal();
        }
    }

    nextSeason() {
        const seasons = this.getSeasons();
        if (this.currentSeason < seasons.length) {
            this.currentSeason++;
            this.updateModal();
        }
    }

    toggleEpisode(season, episode) {
        if (!this.currentShow) return;
        
        const ep = this.currentShow.watchedEpisodes.find(
            e => e.season === season && e.episode === episode
        );
        
        if (!ep) return;
        
        if (!ep.watched) {
            // Mark as watched - check for unwatched episodes before this one
            const allEpisodes = [...this.currentShow.watchedEpisodes]
                .sort((a, b) => {
                    if (a.season !== b.season) return a.season - b.season;
                    return a.episode - b.episode;
                });
            
            const currentIndex = allEpisodes.findIndex(
                e => e.season === season && e.episode === episode
            );
            
            const unwatchedBefore = allEpisodes.slice(0, currentIndex).filter(e => !e.watched);
            
            if (unwatchedBefore.length > 0) {
                if (confirm(`Mark all ${unwatchedBefore.length + 1} episodes up to S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')} as watched?`)) {
                    // Mark all episodes up to this one
                    for (let i = 0; i <= currentIndex; i++) {
                        allEpisodes[i].watched = true;
                    }
                } else {
                    ep.watched = true;
                }
            } else {
                ep.watched = true;
            }
        } else {
            // Mark as unwatched
            ep.watched = false;
        }
        
        this.updateShowWatchedStatus();
        this.save();
    }

    markSeasonWatched(season) {
        if (!this.currentShow) return;
        
        this.currentShow.watchedEpisodes.forEach(ep => {
            if (ep.season === season) ep.watched = true;
        });
        
        this.updateShowWatchedStatus();
        this.save();
    }

    markAllWatched() {
        if (!this.currentShow) return;
        
        this.currentShow.watchedEpisodes.forEach(ep => ep.watched = true);
        this.currentShow.watched = true;
        this.save();
    }

    markAllUnwatched() {
        if (!this.currentShow) return;
        
        this.currentShow.watchedEpisodes.forEach(ep => ep.watched = false);
        this.currentShow.watched = false;
        this.currentShow.userRating = 0;
        this.currentShow.userReview = '';
        this.save();
    }

    updateShowWatchedStatus() {
        const allWatched = this.currentShow.watchedEpisodes.every(e => e.watched);
        this.currentShow.watched = allWatched;
        
        if (!allWatched) {
            this.currentShow.userRating = 0;
            this.currentShow.userReview = '';
        }
    }

    save() {
        dataManager.saveMovies();
        this.updateModal();
        app.refreshUI();
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}