import "./drawerWrapper.css";
import { Backdrop, CircularProgress, Divider, Drawer, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

function DrawerWrapper({children, open, setOpen, loading, title}){

  if(loading){
    return(
      <Backdrop open={loading}>
        <CircularProgress />
      </Backdrop>
    )
  }

  return(
   <Drawer open={open} anchor='right' className='drawerwrapper' onClose={() => setOpen(false)}>
    <div className="content">
      <div className="title-div">
        <Typography variant="h6" className="title">
          {title}
        </Typography>
        <div className="actions">
          <IconButton onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </div>
      </div>
      <Divider style={{width: "100%"}} />
      {children}
    </div>
  </Drawer>
  )
}

export default DrawerWrapper;