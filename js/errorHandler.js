// errorHandler.js
class ErrorHandler {
    static setupGlobalHandlers() {
        window.addEventListener('error', (event) => {
            this.logError('Global Error', event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Unhandled Promise Rejection', event.reason);
        });
    }

    static logError(context, error) {
        const errorInfo = {
            context,
            message: error?.message || 'Unknown error',
            stack: error?.stack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        };

        console.error('Application Error:', errorInfo);
        
        // Show user-friendly error message
        this.showUserNotification(`Something went wrong: ${errorInfo.message}`);
    }

    // In errorHandler.js - IMPROVED VERSION
    static showUserNotification(message, type = 'error') {
        // For errors, we might want different behavior than regular notifications
        if (window.uiManager && window.uiManager.showNotification) {
            try {
                // Use a different method name to avoid the loop, or ensure it's not circular
                window.uiManager.showNotification(message, type);
            } catch (error) {
                // If there's a loop, fall back to basic notification
                this.showBasicNotification(message, type);
            }
        } else {
            this.showBasicNotification(message, type);
        }
    }

    static showBasicNotification(message, type = 'error') {
        // Simple browser-based notification
        if (type === 'error') {
            console.error('Error:', message);
        } else {
            console.log('Notification:', message);
        }
        
        // Optional: Use browser alert for critical errors only
        if (type === 'error' && message.includes('critical')) {
            alert(`Error: ${message}`);
        }
    }
}