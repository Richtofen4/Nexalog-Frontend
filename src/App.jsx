import { Routes, Route, Navigate } from 'react-router-dom';
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'

import Home from './home/home';
import Register from './register/register';
import Login from './login/login';
import ForgotPassword from './forgotPassword/forgotPassword';
import Profile from './profile/profile';
import ServerView from './server/server';

import PrivateRoutes from './components/PrivateRoute';
import PublicRoutes from './components/PublicRoute';
import NotFound from './components/NotFound';


function App() {

  return (
    <Routes>
      {/*Trasy publiczne */}
      <Route
        path="/login"
        element={
          <PublicRoutes>
            <Login />
          </PublicRoutes>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoutes>
            <Register />
          </PublicRoutes>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoutes>
            <ForgotPassword />
          </PublicRoutes>
        }
      />

      {/* Trasy prywatne */}
      <Route
        path="/home"
        element={
          <PrivateRoutes>
            <Home />
          </PrivateRoutes>
        }
      />
      <Route
        path="/server/:id"
        element={
          <PrivateRoutes>
            <ServerView />
          </PrivateRoutes>
        }
      />
      <Route
        path="/profile"
        element={
          <PrivateRoutes>
            <Profile />
          </PrivateRoutes>
        }
      />

      {/* Domyslne przekierowanie */}
      <Route path="/" element={<Navigate to="/home" />} />

      {/* Obsługa nieznanych tras */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
