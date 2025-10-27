// importExport.js
class ImportExportManager {
    showModal() {
        const stats = dataManager.getStats();
        const content = document.getElementById('importExportModalContent');
        
        content.innerHTML = `
            <h2>📊 Backup & Restore</h2>
            <span class="close-modal" onclick="uiManager.hideModal('importExportModal')">&times;</span>
            
            <div class="stats-highlight">
                <strong>Current Collection:</strong>
                <div class="stat-highlight">
                    <div class="stat-highlight-item">
                        <div class="stat-highlight-number">${stats.total}</div>
                        <div class="stat-highlight-label">Total Items</div>
                    </div>
                    <div class="stat-highlight-item">
                        <div class="stat-highlight-number">${stats.movies}</div>
                        <div class="stat-highlight-label">Movies</div>
                    </div>
                    <div class="stat-highlight-item">
                        <div class="stat-highlight-number">${stats.tvShows}</div>
                        <div class="stat-highlight-label">TV Shows</div>
                    </div>
                    <div class="stat-highlight-item">
                        <div class="stat-highlight-number">${stats.watched}</div>
                        <div class="stat-highlight-label">Watched</div>
                    </div>
                </div>
            </div>
            
            <div class="import-export-options">
                <div class="option-card">
                    <h3>📤 Export Data</h3>
                    <p>Download your collection as a JSON backup file.</p>
                    <button onclick="importExportManager.exportData()" class="export-btn">Export Collection</button>
                </div>
                
                <div class="option-card">
                    <h3>📥 Import Data</h3>
                    <p>Restore from a backup file.</p>
                    <input type="file" id="importFile" accept=".json" style="display: none;" onchange="importExportManager.handleFileSelect(event)">
                    <button onclick="document.getElementById('importFile').click()" class="import-btn">
                        Choose Backup File
                    </button>
                    <div class="warning-message">
                        ⚠️ This will replace your current collection!
                    </div>
                </div>
            </div>
        `;
        
        uiManager.showModal('importExportModal');
    }

    exportData() {
        try {
            const exportData = dataManager.exportData();
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().split('T')[0];
            link.href = URL.createObjectURL(dataBlob);
            link.download = `movie-tracker-backup-${timestamp}.json`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(link.href), 100);
            
            uiManager.showNotification(`Successfully exported ${exportData.movies.length} items!`, 'success');
        } catch (error) {
            console.error('Export failed:', error);
            uiManager.showNotification('Export failed: ' + error.message, 'error');
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.name.endsWith('.json')) {
            uiManager.showNotification('Please select a JSON file.', 'error');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            uiManager.showNotification('File too large (max 10MB).', 'error');
            return;
        }
        
        this.importData(file);
        event.target.value = ''; // Reset file input
    }

    async importData(file) {
        try {
            const text = await this.readFile(file);
            const data = JSON.parse(text);
            
            if (!data || !Array.isArray(data.movies)) {
                throw new Error('Invalid backup file format');
            }
            
            const stats = {
                total: data.movies.length,
                movies: data.movies.filter(m => m.type === 'movie').length,
                tvShows: data.movies.filter(m => m.type === 'tv').length
            };
            
            const confirmed = confirm(
                `Import ${stats.total} items?\n\n` +
                `• ${stats.movies} movies\n` +
                `• ${stats.tvShows} TV shows\n\n` +
                `This will REPLACE your current collection!`
            );
            
            if (confirmed) {
                dataManager.importData(data);
                uiManager.showNotification(`Import successful! Loaded ${stats.total} items.`, 'success');
                uiManager.hideModal('importExportModal');
                app.refreshUI();
            }
        } catch (error) {
            console.error('Import failed:', error);
            uiManager.showNotification('Import failed: ' + error.message, 'error');
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Error reading file'));
            reader.readAsText(file);
        });
    }
}