import {
  FormEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useState
} from "react";
import { Form, Button, Spinner } from "react-bootstrap";
import { GeoLocation } from "../types/GeoLocation";

import "./LookupForm.css";

type Automated = { address: string; run: boolean };

type Props = {
  setLegData: React.Dispatch<SetStateAction<GeoLocation | null>>;
  automated: Automated;
};

export const LookupForm = ({ setLegData, automated }: Props) => {
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [zipCode, setZipCode] = useState("");

  async function handleSubmit(e?: FormEvent): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    e && e.preventDefault();

    if (!address || !zipCode) return;

    setLoading(true);
    const payload = { address: [address, zipCode].join(", ") };

    const addresses = await fetch(
      "https://npd-server.herokuapp.com/api/legLookup",
      {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-type": "application/json"
        }
      }
    );

    setLegData(await addresses.json());
    setLoading(false);
  }

  function reset() {
    setAddress("");
    setZipCode("");
  }

  const runSubmit = useCallback(handleSubmit, [address, zipCode, setLegData]);

  useEffect(() => {
    if (!automated?.run) return;
    const parts = automated.address.split(", ");
    automated.run = false;
    if (parts.length > 3) {
      setAddress(parts[0]);
      setZipCode(parts[parts.length - 1].split(" ")[0]);
      automated.run = true;
    } else if (parts[2].split(" ")[0] === "Delaware") {
      setZipCode(parts[0]);
    }
  }, [automated, runSubmit]);

  useEffect(() => {
    if (address && zipCode && automated?.run) runSubmit();
  }, [address, zipCode, automated, runSubmit]);

  return (
    <Form className="form-container" onSubmit={handleSubmit}>
      <Form.Group>
        <Form.Label htmlFor="address">Street Address:</Form.Label>
        <Form.Control
          name="address"
          type="Street"
          required
          onChange={(e) => setAddress(e.target.value)}
          value={address}
        />
      </Form.Group>
      <Form.Group>
        <Form.Label htmlFor="zipCode">Zip Code:</Form.Label>
        <Form.Control
          name="zipCode"
          type="Zip"
          required
          onChange={(e) => setZipCode(e.target.value)}
          value={zipCode}
          maxLength={5}
          onKeyPress={(event) => {
            if (!/[0-9]/.test(event.key)) {
              event.preventDefault();
            }
          }}
        />
      </Form.Group>
      <div className="button-container">
        <Button
          className="prevBtn"
          type="button"
          onClick={reset}
          variant="danger"
        >
          Clear
        </Button>
        <Button className="nextBtn" type="submit">
          {!loading && "Search"}
          {loading && (
            <Spinner
              as="span"
              animation="border"
              size="sm"
              role="status"
              aria-hidden="true"
              style={{ verticalAlign: "middle" }}
            />
          )}
        </Button>
      </div>
    </Form>
  );
};
