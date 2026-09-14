import React, { FC, useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';

const BackButton: React.FC = () => {
    const navigate = useNavigate();

    const handleGoBack = () => {
    navigate(-1);
    };

    return (
    <button onClick={handleGoBack}
    style={{
        // position: 'absolute',
        top: '20px',
        left: '20px',
        padding: '10px',
        background: '#89d6f5',
        color: 'white',
        border: 'none',
        borderRadius: '5px'
}}

    >
        &larr; Back
    </button>
    );
};

export default BackButton;