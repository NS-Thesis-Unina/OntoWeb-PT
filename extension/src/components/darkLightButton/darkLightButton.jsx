import IconButton from "@mui/material/IconButton";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import NightsStayIcon from "@mui/icons-material/NightsStay";
import { useThemeMode } from "../../theme/themeModeProvider";
import "./darkLightButton.css";
import { Tooltip } from "@mui/material";

export default function DarkLightButton({ size = "small" }) {
  const { mode, toggleMode } = useThemeMode();

  return (
    <Tooltip title={mode === "dark" ? "Passa a tema chiaro" : "Passa a tema scuro"}>
      <IconButton
        onClick={() => toggleMode()}
        size={size}
        className="darklightbutton"
      >
        {mode === "dark" ? <WbSunnyIcon fontSize={size} /> : <NightsStayIcon fontSize={size} />}
      </IconButton>
    </Tooltip>
  );
}
