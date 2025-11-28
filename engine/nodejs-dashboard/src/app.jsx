import './app.css'
import { Outlet } from 'react-router-dom';
import NavigationWrapper from './components/navigationWrapper/navigationWrapper';

function App() {

  return (
    <div className="app-div">
      <NavigationWrapper>
        <Outlet/>
      </NavigationWrapper>
    </div>
  )
}

export default App
