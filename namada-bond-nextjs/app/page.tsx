"use client";

import React, { useEffect, useState } from "react";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import EmailIcon from "@mui/icons-material/Email";
import LanguageIcon from "@mui/icons-material/Language";
import { FaDiscord } from "react-icons/fa";
import styles from "./page.module.css";

// Define interfaces for the data structures
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
        console.log(data, "data");
        const mappedRows = data.map(
          (validator: ValidatorData, index: number) => {
            const commissionRate = parseFloat(validator.commission);
            const totalBond = validator.total_bond;
            const totalVotingPower = validator.total_voting_power;
            const row: DataRow = {
              id: index,
              alias: validator.alias ?? "Alias Unknown",
              address: shortenAddress(validator.address),
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

  const shortenAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const columns: GridColDef[] = [
    { field: "alias", headerName: "Name", flex: 1 },
    { field: "address", headerName: "Address", flex: 1 },
    {
      field: "commission",
      headerName: "Commission",
      type: "number",
      flex: 1,
      width: 100,
      headerAlign: "left",
      align: "left",
      valueFormatter: (params: number) => {
        console.log(params, "comission params");
        return `${params.toFixed(2)}%`;
      },
    },
    {
      field: "total_bond",
      headerName: "Total Bond",
      type: "number",
      flex: 1,
      width: 150,
      valueFormatter: (params: number) =>
        params.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }),
    },
    {
      field: "total_voting_power",
      headerName: "Total Voting Power (%)",
      type: "number",
      flex: 1,
      width: 150,
      valueFormatter: (params: string) => `${params}%`,
    },
    {
      field: "email",
      headerName: "",
      renderCell: (params: GridRenderCellParams) =>
        params.value ? (
          <a
            href={`mailto:${params.value}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center" }}
          >
            <EmailIcon sx={{ mt: 1.25 }} />
          </a>
        ) : null,
      sortable: false,
      resizable: false,
      disableColumnMenu: true,
      width: 50,
    },
    {
      field: "website",
      headerName: "",
      renderCell: (params: GridRenderCellParams) =>
        params.value ? (
          <a
            href={params.value}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center" }}
          >
            <LanguageIcon sx={{ mt: 1.25 }} />
          </a>
        ) : null,
      sortable: false,
      resizable: false,
      disableColumnMenu: true,
      width: 50,
    },
    {
      field: "discord_handle",
      headerName: "",
      renderCell: (params: GridRenderCellParams) =>
        params.value ? (
          <a
            href={`https://discord.com/users/${params.value}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "25px" }}
          >
            <FaDiscord />
          </a>
        ) : null,
      sortable: false,
      resizable: false,
      disableColumnMenu: true,
      width: 50,
    },
  ];

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div style={{ height: "800px", width: "75vw" }}>
          <DataGrid
            rows={rows}
            columns={columns}
            pageSizeOptions={[5, 10, 20]}
            sx={{
              "& .MuiDataGrid-row:hover": {
                backgroundColor: "#eee",
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
            }}
          />
        </div>
      </main>
    </div>
  );
}
