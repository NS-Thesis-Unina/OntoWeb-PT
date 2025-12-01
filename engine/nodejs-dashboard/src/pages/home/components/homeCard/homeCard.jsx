import { useNavigate } from "react-router-dom";
import "./homeCard.css";
import { Card, CardContent, Zoom, Typography } from "@mui/material";

function HomeCard({ path, icon, title, description, show, delay = 0 }) {
  const navigate = useNavigate();

  const navigateTo = (to) => {
    navigate(to);
  };

  return (
    <Zoom
      in={show}
      style={{
        transitionDelay: show ? `${delay}ms` : "0ms",
      }}
    >
      <Card
        className="feature-card"
        elevation={2}
        onClick={() => navigateTo(path)}
      >
        <CardContent>
          <div className="title-card">
            {icon}
            <Typography variant="h1">{title}</Typography>
          </div>
          <Typography variant="body2">{description}</Typography>
        </CardContent>
      </Card>
    </Zoom>
  );
}

export default HomeCard;
