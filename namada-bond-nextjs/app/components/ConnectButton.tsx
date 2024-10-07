import React from "react";
import { Button, Box } from "@mui/material";

export const ConnectButton = () => {
  const hasExtension = typeof window !== "undefined" && window.namada;

  return (
    <Box
      sx={{
        backgroundColor: "#FFFF00",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "10px",
        borderRadius: "40px",
        width: "fit-content",
        margin: "auto",
      }}
    >
      <Button
        disabled={!hasExtension}
        sx={{
          backgroundColor: !hasExtension ? "grey" : "black", // Grey background when disabled
          color: !hasExtension ? "lightgrey" : "#FFFF00", // Light grey text when disabled
          borderRadius: "30px", // Rounded inner button
          padding: "15px 40px",
          fontSize: "16px",
          fontWeight: "bold",
          textTransform: "none", // Remove uppercase transformation
          cursor: !hasExtension ? "not-allowed" : "pointer", // Show not-allowed cursor when disabled
          "&:hover": {
            backgroundColor: !hasExtension ? "grey" : "black", // No change on hover if disabled
          },
        }}
      >
        Connect to Namada Extension
      </Button>
    </Box>
  );
};
