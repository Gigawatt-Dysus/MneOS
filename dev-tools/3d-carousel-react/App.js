import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import FramerMotionComponent from './components/framer-motion/FramerMotionComponent';
import ReactCarouselComponent from './components/react-carousel/ReactCarouselComponent';
import ReactSpringCarousel from './components/react-spring-carousel/ReactSpringCarousel';
import "./style.css";

function App() {
    return (
        <Router>
            <nav>
                <ul>
                    <li><Link to="framer-motio-link">Framer Motion</Link></li>
                    <li><Link to="react-carousel-link">React Carousel</Link></li>
                    <li><Link to="react-spring-carousel-link">React Spring Carousel</Link></li>
                </ul>
            </nav>

            <Routes>
                <Route path="framer-motion-link" element={<FramerMotionComponent />} />
                <Route path="react-carousel-link" element={<ReactCarouselComponent />} />
                <Route path="react-spring-carousel-link" element={<ReactSpringCarousel />} />
            </Routes>
        </Router>
    );
}

export default App;
