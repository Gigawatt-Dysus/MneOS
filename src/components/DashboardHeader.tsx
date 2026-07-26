
import React from 'react';

const DashboardHeader: React.FC = () => {
    const glowStyle: React.CSSProperties = {
        textShadow: '0 0 5px rgba(255, 255, 255, 0.7), 0 0 10px rgba(255, 255, 255, 0.5), 0 0 15px rgba(200, 200, 255, 0.3)'
    };

    return (
        <div className="bg-[#000828] py-4 px-6 font-mona-sans text-white text-center shadow-lg rounded-xl w-full mx-auto mb-6">
            <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-4 break-words">
                <span style={glowStyle} className="text-lg sm:text-2xl md:text-4xl font-bold tracking-wider">GENERATIONAL</span>
                <div style={glowStyle} className="flex flex-col text-[0.5rem] sm:text-xs md:text-sm font-bold leading-tight">
                    <span>INTERACTIVE</span>
                    <span>GUIDED</span>
                </div>
                <span style={glowStyle} className="text-lg sm:text-2xl md:text-4xl font-bold tracking-wider">INTERFACE</span>
            </div>
        </div>
    );
};

export default DashboardHeader;
