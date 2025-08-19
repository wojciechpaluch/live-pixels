'use client';
import React, { useState, useEffect, useRef } from 'react';

const GRID_SIZE = 25;
const COLORS = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
    '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43',
    '#10ac84', '#ee5a6f', '#c44569', '#f8b500', '#7bed9f'
];

export default function CollaborativeDrawingApp() {
    const [grid, setGrid] = useState(() =>
        Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null))
    );
    const [userId] = useState("user-" + Math.floor(Math.random() * 100000));
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [clicksRemaining, setClicksRemaining] = useState(10);
    const [lastRefresh, setLastRefresh] = useState(Date.now());
    const [timeToRefresh, setTimeToRefresh] = useState(3600000);
    const [stats, setStats] = useState({
        totalClicks: 0,
        uniqueUsers: 0,
        artwork: 0
    });
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const gridRef = useRef(null);

    const calculateStats = (gridData) => {
        const filledCells = gridData.flat().filter(cell => cell?.color);
        const uniqueUserIds = new Set(filledCells.map(cell => cell.userId).filter(Boolean));

        return {
            totalClicks: filledCells.length,
            uniqueUsers: uniqueUserIds.size,
            artwork: Math.floor(filledCells.length / 10)
        };
    };


    useEffect(() => {
        const fetchGrid = async () => {
            try {
                setIsLoading(true);
                const response = await fetch('https://live-pixels-kkbi.vercel.app/api/grid');

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                setGrid(data);
                setStats(calculateStats(data));

            } catch (error) {
                console.error('Błąd pobierania gridu:', error);
                addNotification('Nie udało się załadować płótna', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchGrid();
    }, []);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const response = await fetch('https://live-pixels-kkbi.vercel.app/api/grid');
                if (response.ok) {
                    const data = await response.json();
                    setGrid(data);
                    setStats(calculateStats(data));
                }
            } catch (error) {
                console.error('Błąd odświeżania gridu:', error);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, []);


    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            const remaining = lastRefresh + 3600000 - now;
            setTimeToRefresh(remaining > 0 ? remaining : 0);

            if (remaining <= 0 && clicksRemaining < 10) {
                setClicksRemaining(10);
                setLastRefresh(now);
                addNotification('Energia odnowiona! +10 kliknięć', 'success');
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [lastRefresh, clicksRemaining]);

    const addNotification = (message, type) => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 3000);
    };

    const formatTime = (ms) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleCellClick = async (x, y) => {
        if (clicksRemaining <= 0) {
            addNotification('Brak energii! Poczekaj na odnowienie', 'warning');
            return;
        }

        if (isLoading) {
            addNotification('Poczekaj, trwa ładowanie...', 'warning');
            return;
        }

        try {
            setIsLoading(true);


            const response = await fetch('https://live-pixels-kkbi.vercel.app/api/grid', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    x: parseInt(x),
                    y: parseInt(y),
                    color: selectedColor,
                    userId
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Błąd serwera: ${response.status} - ${errorText}`);
            }


            setClicksRemaining(prev => Math.max(0, prev - 1));


            const updatedResponse = await fetch('https://live-pixels-kkbi.vercel.app/api/grid');
            if (updatedResponse.ok) {
                const updatedGrid = await updatedResponse.json();
                setGrid(updatedGrid);
                setStats(calculateStats(updatedGrid));
            }

            addNotification('Piksel zaktualizowany!', 'success');

        } catch (error) {
            console.error('Błąd aktualizacji:', error);
            addNotification(`Błąd: ${error.message}`, 'error');


        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '20px',
            fontFamily: 'sans-serif'
        }}>

            <div style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: 1000
            }}>
                {notifications.map(notification => (
                    <div key={notification.id} style={{
                        padding: '12px 16px',
                        marginBottom: '10px',
                        borderRadius: '8px',
                        background: notification.type === 'error' ? 'rgba(239, 68, 68, 0.9)'
                            : notification.type === 'success' ? 'rgba(16, 185, 129, 0.9)'
                                : 'rgba(59, 130, 246, 0.9)',
                        animation: 'slideIn 0.3s ease-out',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                        {notification.message}
                    </div>
                ))}
            </div>

            <style jsx>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>

            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px'
            }}>

                <div>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        padding: '20px',
                        marginBottom: '20px',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <h2 style={{ marginTop: 0, color: clicksRemaining > 0 ? '#4ade80' : '#ef4444' }}>
                            ⚡ Energia: {clicksRemaining}/10
                        </h2>
                        <h2>
                            🕒 Odnowienie: {formatTime(timeToRefresh)}
                        </h2>
                        {isLoading && (
                            <p style={{ color: '#fbbf24', fontSize: '14px' }}>
                                🔄 Ładowanie...
                            </p>
                        )}
                    </div>

                    <div style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        padding: '20px',
                        marginBottom: '20px',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <h3 style={{ marginTop: 0 }}>🎨 Kolory</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {COLORS.map(color => (
                                <button
                                    key={color}
                                    onClick={() => setSelectedColor(color)}
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        background: color,
                                        border: selectedColor === color ? '3px solid white' : '1px solid rgba(255,255,255,0.3)',
                                        cursor: 'pointer',
                                        transform: selectedColor === color ? 'scale(1.1)' : 'scale(1)',
                                        transition: 'all 0.2s ease'
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        padding: '20px',
                        marginBottom: '20px',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <h3 style={{ marginTop: 0 }}>📊 Statystyki</h3>
                        <p>🎨 Pikseli: <strong>{stats.totalClicks}</strong></p>
                        <p>👥 Artystów: <strong>{stats.uniqueUsers}</strong></p>
                        <p>🖼️ Dzieł: <strong>{stats.artwork}</strong></p>
                    </div>

                    <div style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        padding: '20px',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <h3 style={{ marginTop: 0 }}>👤 Twoje ID</h3>
                        <code style={{
                            wordBreak: 'break-all',
                            background: 'rgba(0,0,0,0.2)',
                            padding: '8px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            fontSize: '12px'
                        }}>
                            {userId}
                        </code>
                    </div>
                </div>


                <div style={{ gridColumn: 'span 2' }}>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        padding: '20px',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <h2 style={{ textAlign: 'center', marginTop: 0 }}>
                            🎨 Współdzielone Płótno
                        </h2>

                        <div
                            ref={gridRef}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                                gap: '2px',
                                background: 'rgba(255,255,255,0.2)',
                                padding: '10px',
                                borderRadius: '12px',
                                width: '100%',
                                aspectRatio: '1',
                                maxWidth: '800px',
                                margin: '0 auto',
                                pointerEvents: isLoading ? 'none' : 'auto',
                                opacity: isLoading ? 0.7 : 1,
                                transition: 'opacity 0.2s'
                            }}
                        >
                            {grid.map((row, y) =>
                                row.map((cell, x) => (
                                    <div
                                        key={`${x}-${y}`}
                                        onClick={() => handleCellClick(x, y)}
                                        style={{
                                            backgroundColor: cell?.color || 'rgba(255,255,255,0.1)',
                                            aspectRatio: '1',
                                            borderRadius: '2px',
                                            cursor: clicksRemaining > 0 && !isLoading ? 'pointer' : 'not-allowed',
                                            transition: 'all 0.2s ease',
                                            border: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (clicksRemaining > 0 && !isLoading) {
                                                e.target.style.transform = 'scale(1.1)';
                                                e.target.style.boxShadow = '0 0 10px rgba(255,255,255,0.5)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.transform = 'scale(1)';
                                            e.target.style.boxShadow = 'none';
                                        }}
                                    />
                                ))
                            )}
                        </div>

                        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px' }}>
                            {clicksRemaining > 0 ?
                                'Kliknij na komórkę, aby ją pokolorować' :
                                'Brak energii - poczekaj na odnowienie'
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}