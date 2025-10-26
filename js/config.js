// config.js
const CONFIG = {
    TMDB: {
        API_KEY: '06251a03ea2bdbb4cf38b681d8263a92',
        BASE_URL: 'https://api.themoviedb.org/3',
        IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/',
        RATE_LIMIT_DELAY: 100
    },
    STORAGE: {
        MOVIES_KEY: 'myMovies',
        FILTERS_KEY: 'movieTrackerFilters',
        SETTINGS_KEY: 'movieTrackerSettings'
    },
    APP: {
        VERSION: '2.0',
        BATCH_SIZE: 5,
        CACHE_DURATION: 24 * 60 * 60 * 1000,
        DEBOUNCE_DELAY: 300
    }
};