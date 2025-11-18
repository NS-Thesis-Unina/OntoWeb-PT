import './homeCard.css';
import { Card, CardActionArea, CardContent, Grow, Typography, useTheme } from '@mui/material';
import CategoryIcon from '@mui/icons-material/Category';
import { useNavigate } from 'react-router-dom';

/**
 * **Component: HomeCard**
 *
 * Architectural Role:
 *   This component represents a feature entry point on the Home page.
 *   It visually advertises one of the extension modules (TechStack, Analyzer,
 *   Interceptor) and provides an interactive, animated card that navigates
 *   to the associated route.
 *
 * UX / UI Characteristics:
 *   - Appears with a MUI <Grow> animation.
 *   - Supports optional animation delay (used for staggered card appearance).
 *   - Entire card is clickable via <CardActionArea>.
 *   - Uses theme palette to ensure consistent brand color usage.
 *
 * Props:
 *   - title: string → Title of the feature (e.g., "Analyzer")
 *   - content: string → Short description displayed inside the card
 *   - show: boolean → Controls whether the card is shown (Grow animation)
 *   - delay: number → Delay (ms) before Grow animation starts
 *   - icon: React element → Feature icon (default: generic Category icon)
 *   - pathname: string → Route to navigate when the user clicks the card
 *
 * Navigation:
 *   - Uses `useNavigate()` from react-router-dom to switch routes on click.
 */
function HomeCard({
  title,
  content,
  show = false,
  delay = 0,
  icon = <CategoryIcon />,
  pathname = '/',
}) {
  /**
   * MUI theme hook:
   *   Extracts the palette so we can use palette.primary.main for the title color.
   */
  const { palette } = useTheme();

  /**
   * React Router navigation hook:
   *   Allows the card to programmatically navigate to the requested section.
   */
  const navigate = useNavigate();

  return (
    <Grow
      in={show}
      style={{
        transitionDelay: show ? `${delay}ms` : '0ms',
      }}
    >
      {/* Entire card acts as a button */}
      <Card className="homecard" onClick={() => navigate(pathname)}>
        <CardActionArea>
          <CardContent>
            {/* Header: icon + title */}
            <div className="title">
              {icon}
              <Typography variant="h6" color={palette.primary.main}>
                {title}
              </Typography>
            </div>

            {/* Description text */}
            <Typography variant="body2">{content}</Typography>
          </CardContent>
        </CardActionArea>
      </Card>
    </Grow>
  );
}

export default HomeCard;
