-- backend/schema.sql

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Movies table
CREATE TABLE movies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tmdb_id INTEGER,
    title VARCHAR(500) NOT NULL,
    type VARCHAR(10) CHECK (type IN ('movie', 'tv')),
    year INTEGER,
    genres JSONB DEFAULT '[]',
    tmdb_data JSONB DEFAULT '{}',
    watched BOOLEAN DEFAULT FALSE,
    user_rating INTEGER CHECK (user_rating >= 0 AND user_rating <= 10),
    user_review TEXT,
    total_seasons INTEGER,
    total_episodes INTEGER,
    watched_episodes JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_movies_user_id ON movies(user_id);
CREATE INDEX idx_movies_type ON movies(type);
CREATE INDEX idx_movies_watched ON movies(watched);
CREATE INDEX idx_movies_title ON movies USING gin(to_tsvector('english', title));
CREATE INDEX idx_movies_tmdb_id ON movies(tmdb_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_movies_updated_at BEFORE UPDATE ON movies
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();