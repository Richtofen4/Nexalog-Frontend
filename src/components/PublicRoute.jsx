import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';

const PublicRoutes = ({ children}) => {
    const isAuthenticated = !!localStorage.getItem('token');
    return isAuthenticated ? <Navigate to="/home" /> : children;
};

PublicRoutes.propTypes = {
    children: PropTypes.node.isRequired,
};

export default PublicRoutes;