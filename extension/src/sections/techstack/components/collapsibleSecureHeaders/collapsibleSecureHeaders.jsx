import { Divider, Grid, Stack, Typography } from "@mui/material";
import Collapsible from "../../../../components/collapsible/collapsible";
import "./collapsibleSecureHeaders.css";
import { Fragment } from "react";

function CollapsibleSecureHeaders({ secureHeaders, defaultOpen, expanded }) {
  return (
    <Collapsible defaultOpen={defaultOpen} expanded={expanded} title={`Secure Headers (${secureHeaders.length})`}>
      <div className="collapsiblesecureheaders">
        <Stack divider={<Divider />}>
          {secureHeaders.length > 0 ? secureHeaders.map((item, index) => (
            <Fragment key={index}>
              <Grid container className="csh-mt10">
                <Grid size={6}>
                  <Typography className="csh-bold">Header</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography className="csh-bold">Description</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography>{item.header}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography>{item.description}</Typography>
                </Grid>
              </Grid>

              <Grid container className="csh-mt10">
                <Grid size={12}>
                  <Typography className="csh-bold">URLs ({item.urls.length})</Typography>
                </Grid>
                <Grid size={12} className="csh-cell">
                  <ul className="csh-ul">
                    {item.urls.map((item, index) => (
                      <li key={index}>
                        <Typography className="csh-wrap">
                          {item}
                        </Typography>
                      </li>
                    ))}
                  </ul>
                </Grid>
              </Grid>
            </Fragment>
          )) : (
            <Typography variant="body2">No Secure Headers</Typography>
          )}
        </Stack>
      </div>
    </Collapsible>
  );
}

export default CollapsibleSecureHeaders;
