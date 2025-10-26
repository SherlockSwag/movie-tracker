// importExport.js
class ImportExportManager {
    constructor() {
        this.supportedFormats = ['json'];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
    }

    showImportExportModal() {
        const stats = dataManager.getStats();
        
        const modalContent = `
            <h2>📊 Backup & Restore</h2>
            <span class="close-modal" data-action="close-modal" data-modal="importExportModal">&times;</span>
            
            <div class="stats-highlight">
                <strong>Current Collection Snapshot:</strong>
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
                    <p>Download your entire collection as a JSON file. Perfect for backups or transferring to another device.</p>
                    <button data-action="export-data" class="export-btn">Export Collection</button>
                    
                    <div class="export-format">
                        <h5>📁 Export Includes:</h5>
                        • All movies & TV shows<br>
                        • Watch progress & ratings<br>
                        • TMDB metadata<br>
                        • Episode tracking data<br>
                        • Collection statistics
                    </div>
                </div>
                
                <div class="option-card">
                    <h3>📥 Import Data</h3>
                    <p>Restore from a previous backup or import data from another device.</p>
                    <div class="file-input-wrapper">
                        <input type="file" id="importFile" accept=".json" style="display: none;">
                        <button data-action="choose-import-file" class="import-btn">
                            Choose Backup File
                        </button>
                    </div>
                    
                    <div class="warning-message">
                        ⚠️ <strong>Warning:</strong> This will replace your current collection. Make sure to export first if you want to keep your current data.
                    </div>
                </div>
            </div>
            
            <div class="backup-info">
                <h4>💡 Backup Best Practices:</h4>
                <ul>
                    <li><strong>Export weekly</strong> - Regular backups prevent data loss</li>
                    <li><strong>Store in cloud</strong> - Keep copies on Google Drive, Dropbox, etc.</li>
                    <li><strong>Multiple locations</strong> - Don't rely on a single backup</li>
                    <li><strong>Before major changes</strong> - Always backup before trying new features</li>
                </ul>
            </div>
        `;
        
        document.getElementById('importExportModalContent').innerHTML = modalContent;
        stateManager.setUIModal('importExport', true);
        
        // Setup file input change handler
        const fileInput = document.getElementById('importFile');
        if (fileInput) {
            fileInput.onchange = (event) => this.handleFileSelect(event);
        }
    }

    exportData() {
        try {
            const exportData = dataManager.exportData();
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { 
                type: 'application/json;charset=utf-8' 
            });
            
            // Create download link
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().split('T')[0];
            link.href = URL.createObjectURL(dataBlob);
            link.download = `movie-tracker-backup-${timestamp}.json`;
            link.style.display = 'none';
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up URL
            setTimeout(() => URL.revokeObjectURL(link.href), 100);
            
            // Show success message
            const stats = dataManager.getStats();
            uiManager.showNotification(
                `✅ Successfully exported ${stats.total} items!\n\n` +
                `📁 File: ${link.download}\n` +
                `📊 Includes: ${stats.movies} movies, ${stats.tvShows} TV shows, ${stats.watched} watched items`,
                'success'
            );
            
            eventBus.emit('data:exported', { itemCount: stats.total });
            
        } catch (error) {
            ErrorHandler.logError('Export failed', error);
            uiManager.showNotification('❌ Export failed: ' + error.message, 'error');
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file
        if (!this.validateFile(file)) {
            event.target.value = '';
            return;
        }
        
        this.importData(file);
        event.target.value = ''; // Reset file input
    }

    validateFile(file) {
        // Check file type
        if (!this.supportedFormats.some(format => file.name.toLowerCase().endsWith(`.${format}`))) {
            uiManager.showNotification('❌ Please select a JSON file.', 'error');
            return false;
        }
        
        // Check file size
        if (file.size > this.maxFileSize) {
            uiManager.showNotification('❌ File too large. Maximum size is 10MB.', 'error');
            return false;
        }
        
        // Check if file is empty
        if (file.size === 0) {
            uiManager.showNotification('❌ File is empty.', 'error');
            return false;
        }
        
        return true;
    }

    async importData(file) {
        stateManager.setLoading(true);
        
        try {
            const data = await this.readFile(file);
            const parsedData = this.parseImportData(data);
            
            if (!this.validateImportData(parsedData)) {
                throw new Error('Invalid backup file format');
            }
            
            const importStats = this.calculateImportStats(parsedData);
            this.showImportConfirmation(parsedData, importStats);
            
        } catch (error) {
            ErrorHandler.logError('Import failed', error);
            uiManager.showNotification('❌ Import failed: ' + error.message, 'error');
        } finally {
            stateManager.setLoading(false);
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

    parseImportData(data) {
        try {
            return JSON.parse(data);
        } catch (error) {
            throw new Error('Invalid JSON format');
        }
    }

    validateImportData(data) {
        return dataManager.validateImportData(data);
    }

    calculateImportStats(data) {
        const items = data.movies;
        return {
            total: items.length,
            movies: items.filter(m => m.type === 'movie').length,
            tvShows: items.filter(m => m.type === 'tv').length,
            watched: items.filter(m => m.watched).length,
            exportDate: new Date(data.exportDate).toLocaleDateString(),
            version: data.version
        };
    }

    showImportConfirmation(data, importStats) {
        const currentStats = dataManager.getStats();
        
        const confirmationMessage = `
You're about to IMPORT data:

📥 **Importing:**
• ${importStats.total} total items
• ${importStats.movies} movies
• ${importStats.tvShows} TV shows  
• ${importStats.watched} watched items
• Exported: ${importStats.exportDate}
• Version: ${importStats.version}

📊 **Current Collection:**
• ${currentStats.total} total items
• ${currentStats.movies} movies
• ${currentStats.tvShows} TV shows
• ${currentStats.watched} watched items

⚠️ **This will REPLACE your current collection!**

Do you want to proceed?
        `.trim();
        
        if (confirm(confirmationMessage)) {
            this.performImport(data);
        }
    }

    performImport(data) {
        try {
            dataManager.importData(data);
            
            const stats = dataManager.getStats();
            uiManager.showNotification(
                `✅ Import successful!\n\n` +
                `📊 Loaded: ${stats.total} items\n` +
                `🎬 ${stats.movies} movies\n` +
                `📺 ${stats.tvShows} TV shows\n` +
                `✅ ${stats.watched} watched items`,
                'success'
            );
            
            stateManager.setUIModal('importExport', false);
            
        } catch (error) {
            ErrorHandler.logError('Import processing failed', error);
            uiManager.showNotification('❌ Import failed: ' + error.message, 'error');
        }
    }

    chooseImportFile() {
        const fileInput = document.getElementById('importFile');
        if (fileInput) {
            fileInput.click();
        }
    }
}