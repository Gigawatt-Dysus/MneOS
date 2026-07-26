import React from 'react';
// [FIX] Updated import to match the renamed file and component
import GigiLogo from './GigiLogo';

const LoginHeader: React.FC = () => {
    return (
        <div className="mb-1 flex justify-center">
            {/* [FIX] Updated component name to GigiLogo */}
            <GigiLogo size={350} />
        </div>
    );
};

export default LoginHeader;