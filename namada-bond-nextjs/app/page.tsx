"use client";

import React, { useEffect, useState } from "react";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import EmailIcon from "@mui/icons-material/Email";
import LanguageIcon from "@mui/icons-material/Language";
import { FaDiscord } from "react-icons/fa";
import styles from "./page.module.css";
import { Alert, Link, Typography } from "@mui/material";
import { BondDialog } from "./components/BondDialog";

interface ValidatorData {
  address: string;
  alias: string;
  commission: string;
  max_commission_rate_change: string;
  total_bond: number;
  total_voting_power: number;
  percentage_of_total_supply: string;
  email: string | null;
  website: string | null;
  total_delegations: string;
  discord_handle: string | null;
}

interface DataRow {
  id: number;
  alias: string;
  address: string;
  commission: number;
  total_bond: number;
  total_voting_power: number;
  email?: string | null;
  website?: string | null;
  discord_handle?: string | null;
}

export default function Home() {
  const [rows, setRows] = useState<DataRow[]>([]);
  const hasExtension = typeof window !== "undefined" && window.namada;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedValidator, setSelectedValidator] = useState<{
    address: string;
    alias: string;
  } | null>(null);

  const shortenAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(
          "https://validityops.github.io/namada-bond/validators_data.json"
        );
        if (!res.ok) {
          throw new Error("Failed to fetch data");
        }
        const data: ValidatorData[] = await res.json();
        const mappedRows = data.map(
          (validator: ValidatorData, index: number) => {
            const commissionRate = parseFloat(validator.commission);
            const totalBond = validator.total_bond;
            const totalVotingPower = validator.total_voting_power;
            const row: DataRow = {
              id: index,
              alias: validator.alias ?? "Alias Unknown",
              address: validator.address,
              commission: commissionRate,
              total_bond: totalBond,
              total_voting_power: totalVotingPower,
              email: validator.email,
              website: validator?.website?.includes("Unknown website")
                ? null
                : validator.website,
              discord_handle: validator.discord_handle,
            };

            return row;
          }
        );

        setRows(mappedRows);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    if (rows.length === 0) fetchData();
  }, [rows.length]);

  const columns: GridColDef[] = [
    { field: "alias", headerName: "Name", flex: 1 },
    {
      field: "address",
      headerName: "Address",
      flex: 1,
      valueFormatter: (params) => shortenAddress(params.value),
    },
    {
      field: "commission",
      headerName: "Commission",
      type: "number",
      flex: 1,
      width: 100,
      headerAlign: "right",
      align: "right",
      valueFormatter: (params) => {
        return `${params.value.toFixed(2)}%`;
      },
    },
    {
      field: "total_bond",
      headerName: "Total Bond",
      type: "number",
      flex: 1,
      width: 150,
      valueFormatter: (params) =>
        params.value.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }),
    },
    {
      field: "total_voting_power",
      headerName: "Voting Power (%)",
      type: "number",
      flex: 1,
      width: 150,
      valueFormatter: (params) => `${params.value}%`,
    },
    {
      field: "contact",
      headerName: "",
      renderCell: (params) => (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {params.row.email && (
            <a
              href={`mailto:${params.row.email}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center" }}
            >
              <EmailIcon sx={{ fontSize: "20px", mt: "15px" }} />
            </a>
          )}
          {params.row.website && (
            <a
              href={params.row.website}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center" }}
            >
              <LanguageIcon sx={{ fontSize: "20px", mt: "15px" }} />
            </a>
          )}
          {params.row.discord_handle && (
            <a
              href={`https://discord.com/users/${params.row.discord_handle}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center" }}
            >
              <FaDiscord style={{ fontSize: "20px", marginTop: "15px" }} />
            </a>
          )}
        </div>
      ),
      sortable: false,
      resizable: false,
      disableColumnMenu: true,
      width: 100,
    },
  ];

  const handleRowClick = (params: any) => {
    setSelectedValidator({
      address: params.row.address,
      alias: params.row.alias,
    });
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedValidator(null);
  };

  return (
    <>
      <div className={styles.page}>
        {!hasExtension && (
          <Alert sx={{ mt: 1 }} severity="error">
            You must have the{" "}
            <Link
              href="https://namada.net/extension"
              sx={{ fontWeight: "bold", textDecoration: "underline" }}
              target="_blank"
            >
              Namada Extension
            </Link>{" "}
            installed!
          </Alert>
        )}
        <main className={styles.main}>
          <h1 className={styles.title}>NAMADA PRE-GENESIS BOND</h1>
          <Typography variant="h6" sx={{ mt: -3 }} className={styles.title}>
            Select a Validator to delegate
          </Typography>
          <div style={{ height: "800px", width: "75vw" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              pageSizeOptions={[5, 10, 20]}
              onRowClick={handleRowClick}
              sx={{
                "& .MuiDataGrid-row:hover": {
                  backgroundColor: "#eee",
                  cursor: "pointer",
                },
                "& .MuiDataGrid-columnHeaderTitle": {
                  fontWeight: "bold",
                },
                "& .MuiDataGrid-columnSeparator": {
                  display: "none",
                },
                "& .MuiDataGrid-row": {
                  backgroundColor: "white",
                  border: "1px solid black",
                },
                "& .MuiDataGrid-cell": {
                  borderBottom: "1px solid black",
                },
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "white",
                  borderBottom: "1px solid black",
                },
                // Add the following styles to make pagination visible
                "& .MuiDataGrid-footerContainer": {
                  backgroundColor: "white",
                  color: "black",
                  borderTop: "1px solid black",
                },
                "& .MuiTablePagination-root": {
                  color: "black",
                },
                "& .MuiSvgIcon-root": {
                  color: "black",
                },
                "& .Mui-selected": {
                  backgroundColor: "rgb(255, 255, 0) !important", // Selected row color
                },
                "& .MuiDataGrid-cell:focus, & .MuiDataGrid-row:focus": {
                  outline: "none", // Remove focus outline
                },
              }}
            />
          </div>
        </main>
      </div>
      {selectedValidator && (
        <BondDialog
          open={dialogOpen}
          handleClose={handleDialogClose}
          validatorAddress={selectedValidator.address}
          validatorAlias={selectedValidator.alias}
        />
      )}
    </>
  );
}
