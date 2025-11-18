import './collapsibleSecureHeaders.css';
import { Divider, Grid, Stack, Typography } from '@mui/material';
import { Fragment } from 'react';
import Collapsible from '../../../../../../components/collapsible/collapsible';

/**
 * **CollapsibleSecureHeaders**
 *
 * Renders the list of "Secure Headers" found by the TechStack scan.
 *
 * Architectural Role:
 *   TechStack Results UI
 *     → <ScanResults />
 *       → <CollapsibleSecureHeaders />
 *
 * Responsibilities:
 * - Visualize each detected secure header with:
 *      • Header name
 *      • Human-readable description
 *      • List of URLs where the header was detected
 *
 * - Wraps the entire section inside a <Collapsible> component so that the user
 *   can expand/collapse the block independently or via the "Expand All" function.
 *
 * Props:
 *   - secureHeaders (array): List of { header, description, urls[] }
 *   - defaultOpen (boolean): Initial open state for the Collapsible
 *   - expanded (boolean): Programmatic expansion override (used by "Expand All")
 *
 * Notes:
 * - Uses MUI Grid to structure header information and URLs.
 * - Handles empty state gracefully ("No Secure Headers").
 */
function CollapsibleSecureHeaders({ secureHeaders, defaultOpen, expanded }) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      expanded={expanded}
      title={`Secure Headers (${secureHeaders.length})`}
    >
      <div className="collapsiblesecureheaders">
        {/**
         * Stack with divider:
         * Each secure header entry is visually separated with an MUI Divider.
         */}
        <Stack divider={<Divider />}>
          {secureHeaders.length > 0 ? (
            secureHeaders.map((item, index) => (
              <Fragment key={index}>
                {/* -------------------------------------------
                    HEADER + DESCRIPTION
                   ------------------------------------------- */}
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

                {/* -------------------------------------------
                    URL LIST (where this header was detected)
                   ------------------------------------------- */}
                <Grid container className="csh-mt10">
                  <Grid size={12}>
                    <Typography className="csh-bold">URLs ({item.urls.length})</Typography>
                  </Grid>

                  <Grid size={12} className="csh-cell">
                    <ul className="csh-ul">
                      {item.urls.map((url, index) => (
                        <li key={index}>
                          <Typography className="csh-wrap">{url}</Typography>
                        </li>
                      ))}
                    </ul>
                  </Grid>
                </Grid>
              </Fragment>
            ))
          ) : (
            /**
             * Empty state — if no secure headers were detected.
             */
            <Typography variant="body2">No Secure Headers</Typography>
          )}
        </Stack>
      </div>
    </Collapsible>
  );
}

export default CollapsibleSecureHeaders;
