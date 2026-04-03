import { Routes ,Route } from 'react-router-dom'
import './App.css'
import LobbyScreen from './screens/LobbyScreen'
import Room from './screens/Room';

function App() {

  return (
    <div className='app-container'>
          {/* Background animations */}
          <div className="bg-blob bg-blob-1"></div>
          <div className="bg-blob bg-blob-2"></div>
          
          <Routes>
              <Route path="/" element={<LobbyScreen />} />
              <Route path="/room/:roomId" element={<Room />} />
          </Routes>
    </div>
 );
}

export default App
