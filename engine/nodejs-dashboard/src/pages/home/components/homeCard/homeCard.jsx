import './homeCard.css';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, Zoom, Typography } from '@mui/material';

/**
 * Component: HomeCard
 *
 * Architectural Role:
 * - Reusable feature card used on the Home page to link to a target route.
 * - Encapsulates icon + title + description with an entrance animation.
 *
 * Responsibilities:
 * - Show a clickable <Card> that navigates to the provided `path`.
 * - Apply a Zoom-in animation controlled by `show`/`delay`.
 *
 * Props:
 * @param {string}   path         - Route to navigate to when the card is clicked.
 * @param {React.ReactNode} icon  - Leading icon element displayed in the card header.
 * @param {string}   title        - Feature title.
 * @param {string}   description  - Supporting copy for the feature.
 * @param {boolean}  show         - Whether the card should be visible (animates when true).
 * @param {number}   [delay=0]    - Milliseconds to delay the Zoom animation.
 *
 * UX Notes:
 * - The entire card is clickable; consider keyboard/a11y affordances if needed
 *   (e.g., role="button" and key handlers) in future iterations.
 */
function HomeCard({ path, icon, title, description, show, delay = 0 }) {
  const navigate = useNavigate();

  /** Programmatic navigation helper */
  const navigateTo = (to) => {
    navigate(to);
  };

  return (
    <Zoom
      in={show}
      style={{
        // Staggered entrance: delay is applied only when `show` is true
        transitionDelay: show ? `${delay}ms` : '0ms',
      }}
    >
      <Card className="feature-card" elevation={2} onClick={() => navigateTo(path)}>
        <CardContent>
          {/* Header: icon + title */}
          <div className="title-card">
            {icon}
            <Typography variant="h1">{title}</Typography>
          </div>

          {/* Supporting description */}
          <Typography variant="body2">{description}</Typography>
        </CardContent>
      </Card>
    </Zoom>
  );
}

export default HomeCard;
