# Searoute Route Generation

Simple script to generate sea routes for shipments with empty `completed_route`.

## Setup

Install required dependencies:
```bash
pip install geojson networkx
```

## Usage

Run the script from the `src/searoute` directory:
```bash
cd src/searoute
python generate_route.py
```

## How it works

1. Reads `src/data/shipmentTracking.json`
2. Finds shipments where `completed_route` is empty
3. Uses `current_position` coordinates as origin
4. Uses `destination.coordinates` as destination
5. Calls existing `searoute()` function from the package
6. Updates `remaining_route` with generated coordinates

## Output

The script will:
- Generate route coordinates using the searoute network
- Update `remaining_route` in the JSON file
- Display route statistics (points, length, duration)

## Notes

- Only processes shipments with empty `completed_route`
- Uses existing searoute package (no installation needed)
- No backend required - just run the script manually

