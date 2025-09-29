import { Card, CardActionArea, CardContent, Grow, Typography, useTheme } from "@mui/material";
import "./homeCard.css";
import CategoryIcon from '@mui/icons-material/Category';
import { useNavigate } from "react-router-dom";

function HomeCard({title, content, show = false, delay = 0, icon = <CategoryIcon />, pathname = "/" }){

  const { palette } = useTheme();
  const navigate = useNavigate();

  return(
    <Grow in={show} style={{ transitionDelay: show ? `${delay}ms` : '0ms' }}>
      <Card className="homecard" onClick={() => navigate(pathname)}>
        <CardActionArea>
          <CardContent>
            <div className="title">
              {icon}
              <Typography variant="h6" color={ palette.primary.main }>{title}</Typography>
            </div>
            <Typography variant="body2">
              {content}
            </Typography>
          </CardContent>
        </CardActionArea>
      </Card>
    </Grow>
  )
}

export default HomeCard;