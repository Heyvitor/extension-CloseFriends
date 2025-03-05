-- Create database
CREATE DATABASE IF NOT EXISTS closefriends;
USE closefriends;

-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    api_key VARCHAR(64) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP NULL,
    csrf_token VARCHAR(255),
    ds_user_id VARCHAR(255),
    session_id VARCHAR(255),
    INDEX idx_api_key (api_key)
);

-- Create user progress table
CREATE TABLE IF NOT EXISTS user_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    api_key VARCHAR(64) NOT NULL UNIQUE,
    current_after TEXT,
    next_after TEXT,
    followers_collected INT DEFAULT 0,
    last_follower_added VARCHAR(255),
    last_follower_id VARCHAR(255),
    last_username VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_key) REFERENCES api_keys(api_key),
    INDEX idx_api_key_progress (api_key)
);

-- Insert sample API key for testing (replace with your actual key)
INSERT INTO api_keys (api_key) VALUES ('your-test-key-here'); 