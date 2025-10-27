// js/config.js
const CONFIG = {
    API: {
        // Change this based on your deployment
        BASE_URL: window.location.hostname === 'localhost' 
            ? 'http://localhost:3000/api'  // Local development
            : 'https://your-backend-url.com/api',  // Production (change this!)
        TIMEOUT: 10000
    },
    TMDB: {
        API_KEY: '06251a03ea2bdbb4cf38b681d8263a92',
        BASE_URL: 'https://api.themoviedb.org/3',
        IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/',
        RATE_LIMIT_DELAY: 100
    },
    APP: {
        VERSION: '2.0',
        DEBOUNCE_DELAY: 300,
        ITEMS_PER_PAGE: 50
    }
};