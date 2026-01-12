"""
Simple script to generate sea routes using existing searoute package
Only for shipments with empty completed_route
"""

import json
import sys
import os

# Add src directory to path to import searoute package
script_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.dirname(script_dir)
sys.path.insert(0, src_dir)

# Import existing searoute package
try:
    from searoute.searoute import searoute
    from searoute.utils import distance
except ImportError:
    print("Error: Could not import searoute package")
    print("Make sure you're in the src/searoute directory")
    sys.exit(1)


def find_closest_point_index(current_pos, route_coords):
    """
    Find the index of the closest point in route_coords to current_pos
    
    Args:
        current_pos: [longitude, latitude] of current position
        route_coords: List of [longitude, latitude] coordinates
    
    Returns:
        Index of closest point in route_coords, and the distance
    """
    if not route_coords:
        return 0, float('inf')
    
    min_distance = float('inf')
    closest_index = 0
    distances = []
    
    print(f"    Finding closest point to current position: [{current_pos[0]:.4f}, {current_pos[1]:.4f}]")
    print(f"    Searching in {len(route_coords)} route points...")
    
    # Check ALL points to find the truly closest one
    for i, coord in enumerate(route_coords):
        # distance function expects (lat, lon) tuples
        dist = distance((current_pos[1], current_pos[0]), (coord[1], coord[0]))
        distances.append((i, coord, dist))
        
        if dist < min_distance:
            min_distance = dist
            closest_index = i
    
    # Log first 3, closest point, and last 3
    print(f"    First 3 points:")
    for i, coord, dist in distances[:3]:
        marker = " [CLOSEST]" if i == closest_index else ""
        print(f"      Point {i}: [{coord[0]:.4f}, {coord[1]:.4f}] - Distance: {dist:.2f} km{marker}")
    
    if closest_index >= 3 and closest_index < len(route_coords) - 3:
        print(f"    ...")
        marker = " [CLOSEST]"
        print(f"      Point {closest_index}: [{distances[closest_index][1][0]:.4f}, {distances[closest_index][1][1]:.4f}] - Distance: {min_distance:.2f} km{marker}")
        print(f"    ...")
    
    if len(distances) > 3:
        print(f"    Last 3 points:")
        for i, coord, dist in distances[-3:]:
            marker = " [CLOSEST]" if i == closest_index else ""
            print(f"      Point {i}: [{coord[0]:.4f}, {coord[1]:.4f}] - Distance: {dist:.2f} km{marker}")
    
    print(f"    [OK] Closest point found at index {closest_index} of {len(route_coords)}")
    print(f"    [OK] Closest point coordinates: [{route_coords[closest_index][0]:.4f}, {route_coords[closest_index][1]:.4f}]")
    print(f"    [OK] Distance to closest point: {min_distance:.2f} km")
    
    return closest_index, min_distance


def process_shipment_tracking():
    """Process shipmentTracking.json and generate routes for shipments with empty completed_route"""
    
    # Path to shipmentTracking.json
    json_file = os.path.join(src_dir, 'data', 'shipmentTracking.json')
    
    if not os.path.exists(json_file):
        print(f"Error: File not found: {json_file}")
        sys.exit(1)
    
    # Read JSON file
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    updated = False
    
    for shipment in data.get('shipments', []):
        route_coords = shipment.get('route_coordinates', {})
        completed_route = route_coords.get('completed_route', [])
        shipment_status = shipment.get('shipment_status', '')
        
        # Process if:
        # 1. completed_route is empty, OR
        # 2. completed_route is NOT empty AND shipment_status is "in_transit"
        should_process = (
            len(completed_route) == 0 or 
            (len(completed_route) > 0 and shipment_status == 'in_transit')
        )
        
        if should_process:
            shipment_id = shipment.get('shipment_id') or shipment.get('shipment_order_number')
            
            # Get origin from current_position
            current_pos = shipment.get('current_position', {})
            origin_lat = current_pos.get('latitude')
            origin_lon = current_pos.get('longitude')
            
            # Get destination from route_info
            route_info = shipment.get('route_info', {})
            destination = route_info.get('destination', {})
            dest_coords = destination.get('coordinates', {})
            dest_lat = dest_coords.get('latitude')
            dest_lon = dest_coords.get('longitude')
            
            if all([origin_lat is not None, origin_lon is not None, dest_lat is not None, dest_lon is not None]):
                print(f"\n{'='*60}")
                print(f"Processing shipment: {shipment_id}")
                print(f"Status: {shipment_status}")
                print(f"Completed route points: {len(completed_route)}")
                print(f"Origin (current_position): [{origin_lat}, {origin_lon}]")
                print(f"Destination: [{dest_lat}, {dest_lon}]")
                
                try:
                    # Searoute expects [longitude, latitude] format
                    origin = [origin_lon, origin_lat]
                    destination_point = [dest_lon, dest_lat]
                    
                    # Use existing searoute function
                    route = searoute(origin, destination_point, include_ports=False)
                    
                    # Get coordinates from route (format: [[lon, lat], [lon, lat], ...])
                    route_coords_list = route.geometry.coordinates
                    
                    # For in_transit shipments with completed_route, find closest point to current_position
                    if len(completed_route) > 0 and shipment_status == 'in_transit':
                        print(f"\n  {'='*70}")
                        print(f"  IN-TRANSIT HANDLING - Step by Step Flow")
                        print(f"  {'='*70}")
                        
                        print(f"\n  STEP 1: Initial State Check")
                        print(f"  - Shipment status: {shipment_status}")
                        print(f"  - Completed route points: {len(completed_route)}")
                        print(f"  - Current position (vessel): [{origin[0]:.4f}, {origin[1]:.4f}]")
                        
                        # Check last point of completed_route for reference
                        last_completed = completed_route[-1]
                        last_completed_coords = [last_completed['longitude'], last_completed['latitude']]
                        dist_to_last_completed = distance((origin[1], origin[0]), (last_completed['latitude'], last_completed['longitude']))
                        print(f"  - Last point of completed_route: [{last_completed_coords[0]:.4f}, {last_completed_coords[1]:.4f}]")
                        print(f"  - Distance from current position to last completed: {dist_to_last_completed:.2f} km")
                        
                        print(f"\n  STEP 2: Full Route Generation (searoute package)")
                        print(f"  - Calling searoute(origin, destination, include_ports=False)")
                        print(f"  - Origin: [{origin[0]:.4f}, {origin[1]:.4f}]")
                        print(f"  - Destination: [{destination_point[0]:.4f}, {destination_point[1]:.4f}]")
                        print(f"  - Generated route has {len(route_coords_list)} points")
                        print(f"  - First point of generated route: [{route_coords_list[0][0]:.4f}, {route_coords_list[0][1]:.4f}]")
                        print(f"  - Last point of generated route: [{route_coords_list[-1][0]:.4f}, {route_coords_list[-1][1]:.4f}]")
                        print(f"  - Route format: [[lon, lat], [lon, lat], ..., [lon, lat]]")
                        
                        print(f"\n  STEP 3: Generate Dense Points between First Two Waypoints")
                        print(f"  - Current vessel position (for closest search): [{origin[0]:.4f}, {origin[1]:.4f}]")

                        dense_points = []
                        if len(route_coords_list) >= 2:
                            p0 = route_coords_list[0]
                            p1 = route_coords_list[1]
                            num_dense = 10

                            print(f"  - Using route point 0: [{p0[0]:.4f}, {p0[1]:.4f}]")
                            print(f"  - Using route point 1: [{p1[0]:.4f}, {p1[1]:.4f}]")
                            print(f"  - Generating {num_dense} interpolated points between point 0 and point 1")

                            for i in range(1, num_dense + 1):
                                t = i / (num_dense + 1)
                                lon = p0[0] + t * (p1[0] - p0[0])
                                lat = p0[1] + t * (p1[1] - p0[1])
                                dense_points.append([lon, lat])

                            # Log first few dense points
                            print(f"  - Sample of generated dense points:")
                            for idx, coord in enumerate(dense_points[:5]):
                                print(f"    Dense {idx}: [{coord[0]:.4f}, {coord[1]:.4f}]")
                            if len(dense_points) > 5:
                                print(f"    ... ({len(dense_points) - 5} more dense points) ...")
                        else:
                            # Fallback: not enough points to interpolate, use original algorithm on full route
                            print(f"  - WARNING: Route has < 2 points, falling back to closest search on full route")
                            dense_points = route_coords_list[:]

                        print(f"\n  STEP 4: Closest Point Analysis (using interpolated segment)")
                        print(f"  - Searching in {len(dense_points)} dense points between point 0 and point 1")

                        closest_idx, closest_distance = find_closest_point_index(origin, dense_points)
                        closest_point = dense_points[closest_idx] if dense_points else route_coords_list[0]

                        print(f"  - Closest dense point INDEX: {closest_idx} of {len(dense_points)}")
                        print(f"  - Closest dense point coordinates: [{closest_point[0]:.4f}, {closest_point[1]:.4f}]")
                        print(f"  - Distance to closest dense point: {closest_distance:.2f} km")

                        print(f"\n  STEP 5: Build Short Connection from Vessel to Route")
                        original_length = len(route_coords_list)
                        print(f"  - Original route length: {original_length} points")
                        print(f"  - Connection structure will be: [current_pos, closest_dense_point, point_1, point_2, ...]")

                        # Build new route: current vessel position -> closest dense point -> from original point 1 onwards
                        if len(route_coords_list) >= 2:
                            final_route_coords = [origin, closest_point] + route_coords_list[1:]
                        else:
                            # Fallback: just prepend current position
                            final_route_coords = [origin] + route_coords_list

                        print(f"  - New route length after adding connection: {len(final_route_coords)} points")

                        print(f"\n  STEP 6: Final Route Structure")
                        print(f"  - Point 0 (current vessel - EXACT position): [{final_route_coords[0][0]:.4f}, {final_route_coords[0][1]:.4f}]")
                        if len(final_route_coords) > 1:
                            print(f"  - Point 1 (closest dense waypoint): [{final_route_coords[1][0]:.4f}, {final_route_coords[1][1]:.4f}]")
                        if len(final_route_coords) > 2:
                            print(f"  - Point 2 (original route point 1): [{final_route_coords[2][0]:.4f}, {final_route_coords[2][1]:.4f}]")
                        if len(final_route_coords) > 3:
                            print(f"  - ... ({len(final_route_coords)-3} more points) ...")
                        print(f"  - Point {len(final_route_coords)-1} (destination): [{final_route_coords[-1][0]:.4f}, {final_route_coords[-1][1]:.4f}]")
                        print(f"  - Total points in remaining_route: {len(final_route_coords)}")

                        print(f"\n  SUMMARY:")
                        print(f"  - Generated full route: {original_length} points")
                        print(f"  - Generated dense segment between point 0 and 1: {len(dense_points)} points")
                        print(f"  - Selected closest dense point at index: {closest_idx}")
                        print(f"  - Added current position as first point: 1 point")
                        print(f"  - Final remaining_route: {len(final_route_coords)} points")
                        print(f"  - Route structure: [current_pos, closest_dense_point, point_1, ..., destination]")
                        print(f"  {'='*70}\n")

                        # Replace original route_coords_list with the newly built route for saving
                        route_coords_list = final_route_coords
                    
                    # Convert to our format: [{"latitude": lat, "longitude": lon}, ...]
                    converted_coords = [
                        {"latitude": coord[1], "longitude": coord[0]}
                        for coord in route_coords_list
                    ]
                    
                    # Update remaining_route
                    shipment['route_coordinates']['remaining_route'] = converted_coords
                    updated = True
                    
                    print(f"✓ Route generated: {len(converted_coords)} points")
                    print(f"  Length: {route.properties.get('length', 'N/A')} {route.properties.get('units', 'km')}")
                    print(f"  Duration: {route.properties.get('duration_hours', 'N/A')} hours")
                    
                except Exception as e:
                    print(f"✗ Error generating route: {str(e)}")
                    import traceback
                    traceback.print_exc()
            else:
                print(f"✗ Missing coordinates for shipment {shipment_id}")
                print(f"  Origin: lat={origin_lat}, lon={origin_lon}")
                print(f"  Destination: lat={dest_lat}, lon={dest_lon}")
    
    # Save updated JSON
    if updated:
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"\n{'='*60}")
        print("✓ Updated shipmentTracking.json")
        print(f"{'='*60}")
    else:
        print("\nNo shipments with empty completed_route found.")


if __name__ == "__main__":
    process_shipment_tracking()

