// backend/routes/movies.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const movieController = require('../controllers/movieController');

// All routes require authentication
router.use(auth);

// GET /api/movies - Get all movies with filters
router.get('/', movieController.getMovies);

// GET /api/movies/stats - Get statistics
router.get('/stats', movieController.getStats);

// GET /api/movies/search - Search movies
router.get('/search', movieController.searchMovies);

// GET /api/movies/export - Export data
router.get('/export', movieController.exportData);

// GET /api/movies/:id - Get single movie
router.get('/:id', movieController.getMovieById);

// POST /api/movies - Add new movie
router.post('/', movieController.addMovie);

// POST /api/movies/import - Import data
router.post('/import', movieController.importData);

// PUT /api/movies/:id - Update movie
router.put('/:id', movieController.updateMovie);

// DELETE /api/movies/:id - Delete movie
router.delete('/:id', movieController.deleteMovie);

// POST /api/movies/:id/toggle-watched - Toggle watched status
router.post('/:id/toggle-watched', movieController.toggleWatched);

// PUT /api/movies/:id/episodes - Update episodes
router.put('/:id/episodes', movieController.updateEpisodes);

module.exports = router;