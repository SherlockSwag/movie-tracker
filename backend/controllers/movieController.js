// backend/controllers/movieController.js
const db = require('../db');

exports.getMovies = async (req, res) => {
    try {
        const userId = req.user.id;
        const { type, watched, search, genre, sortBy = 'addedDate', limit = 100, offset = 0 } = req.query;
        
        let query = 'SELECT * FROM movies WHERE user_id = $1';
        const params = [userId];
        let paramIndex = 2;
        
        // Apply filters
        if (type && type !== 'all') {
            query += ` AND type = $${paramIndex++}`;
            params.push(type);
        }
        
        if (watched !== undefined && watched !== 'all') {
            const isWatched = watched === 'true' || watched === 'watched';
            query += ` AND watched = $${paramIndex++}`;
            params.push(isWatched);
        }
        
        if (search) {
            query += ` AND title ILIKE $${paramIndex++}`;
            params.push(`%${search}%`);
        }
        
        if (genre && genre !== 'all') {
            query += ` AND genres::text ILIKE $${paramIndex++}`;
            params.push(`%${genre}%`);
        }
        
        // Sorting
        const sortOptions = {
            'addedDate': 'created_at DESC',
            'title': 'title ASC',
            'titleDesc': 'title DESC',
            'year': 'year DESC',
            'yearOld': 'year ASC',
            'rating': 'user_rating DESC NULLS LAST'
        };
        query += ` ORDER BY ${sortOptions[sortBy] || 'created_at DESC'}`;
        
        // Pagination
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);
        
        const result = await db.query(query, params);
        
        res.json({
            movies: result.rows,
            total: result.rowCount
        });
    } catch (error) {
        console.error('Get movies error:', error);
        res.status(500).json({ error: 'Failed to fetch movies' });
    }
};

exports.getMovieById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const result = await db.query(
            'SELECT * FROM movies WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Movie not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get movie error:', error);
        res.status(500).json({ error: 'Failed to fetch movie' });
    }
};

exports.addMovie = async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            tmdb_id, title, type, year, genres, 
            tmdb_data, totalSeasons, totalEpisodes, watchedEpisodes 
        } = req.body;
        
        const result = await db.query(
            `INSERT INTO movies (
                user_id, tmdb_id, title, type, year, genres, 
                tmdb_data, total_seasons, total_episodes, watched_episodes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
            RETURNING *`,
            [
                userId, tmdb_id, title, type, year, 
                JSON.stringify(genres), JSON.stringify(tmdb_data),
                totalSeasons, totalEpisodes, JSON.stringify(watchedEpisodes || [])
            ]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add movie error:', error);
        res.status(500).json({ error: 'Failed to add movie' });
    }
};

exports.updateMovie = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const updates = req.body;
        
        // Build UPDATE query dynamically
        const fields = [];
        const values = [id, userId];
        let paramIndex = 3;
        
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = $${paramIndex++}`);
            values.push(typeof value === 'object' ? JSON.stringify(value) : value);
        }
        
        if (fields.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }
        
        const query = `
            UPDATE movies 
            SET ${fields.join(', ')}, updated_at = NOW() 
            WHERE id = $1 AND user_id = $2 
            RETURNING *
        `;
        
        const result = await db.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Movie not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update movie error:', error);
        res.status(500).json({ error: 'Failed to update movie' });
    }
};

exports.deleteMovie = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const result = await db.query(
            'DELETE FROM movies WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Movie not found' });
        }
        
        res.json({ message: 'Movie deleted', movie: result.rows[0] });
    } catch (error) {
        console.error('Delete movie error:', error);
        res.status(500).json({ error: 'Failed to delete movie' });
    }
};

exports.toggleWatched = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const result = await db.query(
            `UPDATE movies 
             SET watched = NOT watched, updated_at = NOW() 
             WHERE id = $1 AND user_id = $2 
             RETURNING *`,
            [id, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Movie not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Toggle watched error:', error);
        res.status(500).json({ error: 'Failed to toggle watched status' });
    }
};

exports.updateEpisodes = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { episodes } = req.body;
        
        const result = await db.query(
            `UPDATE movies 
             SET watched_episodes = $1, updated_at = NOW() 
             WHERE id = $2 AND user_id = $3 
             RETURNING *`,
            [JSON.stringify(episodes), id, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Movie not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update episodes error:', error);
        res.status(500).json({ error: 'Failed to update episodes' });
    }
};

exports.getStats = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await db.query(
            `SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE type = 'movie') as movies,
                COUNT(*) FILTER (WHERE type = 'tv') as tv_shows,
                COUNT(*) FILTER (WHERE watched = true) as watched
             FROM movies 
             WHERE user_id = $1`,
            [userId]
        );
        
        const stats = result.rows[0];
        
        res.json({
            total: parseInt(stats.total),
            movies: parseInt(stats.movies),
            tvShows: parseInt(stats.tv_shows),
            watched: parseInt(stats.watched)
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
};

exports.searchMovies = async (req, res) => {
    try {
        const userId = req.user.id;
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({ error: 'Search query required' });
        }
        
        const result = await db.query(
            `SELECT * FROM movies 
             WHERE user_id = $1 AND title ILIKE $2
             ORDER BY created_at DESC
             LIMIT 50`,
            [userId, `%${q}%`]
        );
        
        res.json({ movies: result.rows });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
};

exports.exportData = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await db.query(
            'SELECT * FROM movies WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        
        const exportData = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            movies: result.rows
        };
        
        res.json(exportData);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Export failed' });
    }
};

exports.importData = async (req, res) => {
    try {
        const userId = req.user.id;
        const { movies } = req.body;
        
        if (!Array.isArray(movies)) {
            return res.status(400).json({ error: 'Invalid import data' });
        }
        
        // Delete existing movies
        await db.query('DELETE FROM movies WHERE user_id = $1', [userId]);
        
        // Insert imported movies
        let importedCount = 0;
        
        for (const movie of movies) {
            try {
                await db.query(
                    `INSERT INTO movies (
                        user_id, tmdb_id, title, type, year, genres, 
                        tmdb_data, watched, user_rating, user_review,
                        total_seasons, total_episodes, watched_episodes
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                    [
                        userId,
                        movie.tmdb_id,
                        movie.title,
                        movie.type,
                        movie.year,
                        JSON.stringify(movie.genres || []),
                        JSON.stringify(movie.tmdb_data || {}),
                        movie.watched || false,
                        movie.userRating || movie.user_rating || null,
                        movie.userReview || movie.user_review || null,
                        movie.totalSeasons || movie.total_seasons || null,
                        movie.totalEpisodes || movie.total_episodes || null,
                        JSON.stringify(movie.watchedEpisodes || movie.watched_episodes || [])
                    ]
                );
                importedCount++;
            } catch (error) {
                console.error('Error importing movie:', movie.title, error);
            }
        }
        
        res.json({ 
            message: 'Import successful',
            imported: importedCount,
            total: movies.length
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Import failed' });
    }
};

module.exports = exports;