import './darkLightButton.css';
import IconButton from '@mui/material/IconButton';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import { useThemeMode } from '../../theme/themeModeProvider';
import { Tooltip } from '@mui/material';

/**
 * **Component: DarkLightButton**
 *
 * Purpose:
 *   Single-icon toggle for the global color scheme. Reads and flips the theme
 *   via `useThemeMode()` context. The tooltip reflects the *next* action.
 *
 * UX:
 *   - When current mode is "dark": show a sun icon (tap → switch to light).
 *   - When current mode is "light": show a moon icon (tap → switch to dark).
 *
 * Props:
 *   @param {'small'|'medium'|'large'|'inherit'} [size='small']
 *     MUI IconButton size (also applied to icon's `fontSize`).
 */
export default function DarkLightButton({ size = 'small' }) {
  const { mode, toggleMode } = useThemeMode();

  return (
    <Tooltip title={mode === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}>
      <IconButton onClick={toggleMode} size={size} className="darklightbutton">
        {mode === 'dark' ? <WbSunnyIcon fontSize={size} /> : <NightsStayIcon fontSize={size} />}
      </IconButton>
    </Tooltip>
  );
}
