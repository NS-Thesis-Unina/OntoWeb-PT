import { useNavigate } from "react-router-dom";
import { Card, CardContent, Zoom, Typography, Paper } from "@mui/material";
import "./homeCard.css";

function HomeCard({ path, icon, title, description, show = true }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (path) {
      navigate(path);
    }
  };

  return (
    <Zoom in={show}>
      <Card
        className="feature-card"
        elevation={2}
        onClick={handleClick}
      >
        <CardContent>
          <div className="title-card">
            {icon}
            <Typography variant="h1">{title}</Typography>
          </div>
          <Typography variant="body2">
            {description}
          </Typography>
        </CardContent>
      </Card>
    </Zoom>
  );
}

export default HomeCard;
