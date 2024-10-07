import React, { useState } from "react";
import { Box, Typography, Grid } from "@mui/material";
import InclineArrowBlack from "public/incline-arrow-black.svg";
import InclineArrowYellow from "public/incline-arrow-yellow.svg";

type Props = {
  description: string;
  title: string;
  href: string;
};

export const CallToActionCard: React.FC<Props> = ({
  description,
  title,
  href,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const onHover = (): void => {
    setIsHovered(true);
  };

  const onLeave = (): void => {
    setIsHovered(false);
  };

  return (
    <Grid
      container
      component="a"
      href={href}
      target="_blank"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      sx={{
        backgroundColor: isHovered ? "black" : "#FFFF00",
        color: isHovered ? "white" : "black",
        padding: "16px",
        border: "1px solid black",
        position: "relative",
        textDecoration: "none",
        display: "block",
        cursor: "pointer",
        transition: "background-color 0.3s, color 0.3s",
      }}
    >
      {/* Borders */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          border: "1px solid black",
          pointerEvents: "none",
        }}
      />
      {/* Description */}
      <Grid item xs={12}>
        <Typography variant="body2">{description}</Typography>
      </Grid>
      {/* Title and Arrow */}
      <Grid
        item
        xs={12}
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "16px",
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
          {title}
        </Typography>
        <img
          src={isHovered ? InclineArrowYellow : InclineArrowBlack}
          alt="arrow"
        />
      </Grid>
    </Grid>
  );
};
