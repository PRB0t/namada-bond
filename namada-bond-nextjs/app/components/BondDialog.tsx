import React from "react";
import { Dialog, DialogTitle, DialogContent, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { GenesisBondForm } from "./GenesisBondForm";

interface BondDialogProps {
  open: boolean;
  handleClose: () => void;
  validatorAddress: string;
  validatorAlias: string;
}

export const BondDialog: React.FC<BondDialogProps> = ({
  open,
  handleClose,
  validatorAddress,
  validatorAlias,
}) => {
  // Dummy accounts and validators data
  const accounts = [
    {
      alias: "My Account",
      address: "tnam1qypqxpqyclu3xpjyl9gyh6t49xvsc9t75tke7y",
      publicKey: "PubKey123",
    },
  ];

  const validators = [
    {
      label: validatorAlias,
      value: validatorAddress,
    },
  ];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Bond to Validator: {validatorAlias}
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <GenesisBondForm accounts={accounts} validators={validators} />
      </DialogContent>
    </Dialog>
  );
};
