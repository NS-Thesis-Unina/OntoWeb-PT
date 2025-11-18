import './darkLightButton.css';
import IconButton from '@mui/material/IconButton';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import { useThemeMode } from '../../theme/themeModeProvider';
import { Tooltip } from '@mui/material';

/**
 * **DarkLightButton**
 *
 * A small toggle button that switches between the application's dark
 * and light themes. The component uses the ThemeModeProvider context
 * to retrieve the current mode and toggle function.
 *
 * UX Notes:
 * - Uses an MUI tooltip to indicate the target theme.
 * - The icon changes based on current mode (sun for dark → light, moon for light → dark).
 *
 * @param {Object} props
 * @param {"small"|"medium"|"large"} [props.size="small"] - IconButton size.
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
