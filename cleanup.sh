#!/bin/bash

# SRE Assignment Cleanup Script
# This script completely removes all containers, volumes, images, and networks

set -e

echo "🧹 SRE Assignment Cleanup Script"
echo "================================="
echo ""

# Function to ask for confirmation
confirm_cleanup() {
    echo "⚠️  WARNING: This will completely remove:"
    echo "   • All Docker containers"
    echo "   • All Docker volumes (including data)"
    echo "   • All Docker images for this project"
    echo "   • All Docker networks"
    echo "   • All log files"
    echo ""
    read -p "Are you sure you want to proceed? (yes/no): " confirmation
    
    if [[ $confirmation != "yes" ]]; then
        echo "❌ Cleanup cancelled."
        exit 0
    fi
}

# Function to stop and remove containers
stop_containers() {
    echo "🛑 Stopping all containers..."
    
    if docker compose ps -q &> /dev/null; then
        docker compose down --timeout 30
        echo "  ✅ Containers stopped"
    else
        echo "  ℹ️  No running containers found"
    fi
}

# Function to remove volumes
remove_volumes() {
    echo "🗑️  Removing all volumes..."
    
    # Remove project-specific volumes
    docker compose down --volumes --remove-orphans &> /dev/null || true
    
    # List and remove any remaining volumes related to the project
    volumes=$(docker volume ls -q | grep -E "(sre|tidb|pd|tikv|kafka|zookeeper)" 2>/dev/null || true)
    
    if [[ -n "$volumes" ]]; then
        echo "  Removing volumes: $volumes"
        echo "$volumes" | xargs docker volume rm 2>/dev/null || true
        echo "  ✅ Volumes removed"
    else
        echo "  ℹ️  No project volumes found"
    fi
}

# Function to remove images
remove_images() {
    echo "🖼️  Removing Docker images..."
    
    # Remove project-built images
    project_images=$(docker images --format "table {{.Repository}}:{{.Tag}}" | grep -E "(sre-|pingcap|confluentinc)" | awk '{print $1}' 2>/dev/null || true)
    
    if [[ -n "$project_images" ]]; then
        echo "  Removing images..."
        echo "$project_images" | xargs docker rmi -f 2>/dev/null || true
        echo "  ✅ Project images removed"
    else
        echo "  ℹ️  No project images found"
    fi
    
    # Remove dangling images
    dangling_images=$(docker images -f "dangling=true" -q 2>/dev/null || true)
    if [[ -n "$dangling_images" ]]; then
        echo "  Removing dangling images..."
        echo "$dangling_images" | xargs docker rmi 2>/dev/null || true
        echo "  ✅ Dangling images removed"
    fi
}

# Function to remove networks
remove_networks() {
    echo "🌐 Removing Docker networks..."
    
    # Remove project network
    project_networks=$(docker network ls --format "{{.Name}}" | grep -E "(sre|default)" 2>/dev/null || true)
    
    if [[ -n "$project_networks" ]]; then
        echo "  Removing networks: $project_networks"
        echo "$project_networks" | xargs docker network rm 2>/dev/null || true
        echo "  ✅ Networks removed"
    else
        echo "  ℹ️  No project networks found"
    fi
}

# Function to clean up log files
cleanup_logs() {
    echo "📝 Cleaning up log files..."
    
    # Remove log directories and files
    if [[ -d "backend/logs" ]]; then
        rm -rf backend/logs/*
        echo "  ✅ Backend logs cleaned"
    fi
    
    if [[ -d "consumer/logs" ]]; then
        rm -rf consumer/logs/*
        echo "  ✅ Consumer logs cleaned"
    fi
    
    # Recreate empty log directories
    mkdir -p backend/logs
    mkdir -p consumer/logs
    
    echo "  ✅ Log directories reset"
}

# Function to run Docker system cleanup
docker_system_cleanup() {
    echo "🔧 Running Docker system cleanup..."
    
    # Remove unused containers, networks, images, and build cache
    docker system prune -f &> /dev/null || true
    echo "  ✅ Docker system pruned"
    
    # Remove all unused volumes
    docker volume prune -f &> /dev/null || true
    echo "  ✅ Unused volumes pruned"
}

# Function to verify cleanup
verify_cleanup() {
    echo "🔍 Verifying cleanup..."
    
    # Check for running containers
    running_containers=$(docker ps --format "{{.Names}}" | grep -E "(sre|tidb|kafka|zookeeper)" 2>/dev/null || true)
    if [[ -z "$running_containers" ]]; then
        echo "  ✅ No project containers running"
    else
        echo "  ⚠️  Some containers still running: $running_containers"
    fi
    
    # Check for remaining volumes
    remaining_volumes=$(docker volume ls -q | grep -E "(sre|tidb|pd|tikv|kafka)" 2>/dev/null || true)
    if [[ -z "$remaining_volumes" ]]; then
        echo "  ✅ No project volumes remaining"
    else
        echo "  ⚠️  Some volumes still exist: $remaining_volumes"
    fi
    
    # Check for remaining images
    remaining_images=$(docker images --format "{{.Repository}}" | grep -E "(sre-|pingcap|confluentinc)" 2>/dev/null || true)
    if [[ -z "$remaining_images" ]]; then
        echo "  ✅ No project images remaining"
    else
        echo "  ℹ️  Some base images still exist (this is normal)"
    fi
}

# Function to show final status
show_final_status() {
    echo ""
    echo "📊 Final System Status:"
    echo "======================="
    
    echo "Docker containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}" | head -10
    
    echo ""
    echo "Docker images:"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | head -10
    
    echo ""
    echo "Docker volumes:"
    docker volume ls | head -10
    
    echo ""
    echo "Disk space:"
    df -h | grep -E "(Filesystem|/dev/)"
}

# Main cleanup function
main() {
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        echo "❌ Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if we're in the right directory
    if [[ ! -f "compose.yml" && ! -f "docker-compose.yml" ]]; then
        echo "❌ No compose.yml or docker-compose.yml found. Please run this script from the project directory."
        exit 1
    fi
    
    # Ask for confirmation
    confirm_cleanup
    
    echo ""
    echo "🚀 Starting cleanup process..."
    echo ""
    
    # Execute cleanup steps
    stop_containers
    remove_volumes
    remove_images
    remove_networks
    cleanup_logs
    docker_system_cleanup
    verify_cleanup
    
    echo ""
    echo "🎉 Cleanup completed successfully!"
    echo "=================================="
    echo ""
    echo "✅ All containers stopped and removed"
    echo "✅ All volumes and data deleted"
    echo "✅ Project images removed"
    echo "✅ Networks cleaned up"
    echo "✅ Log files cleared"
    echo "✅ Docker system pruned"
    echo ""
    echo "💾 Disk space freed up:"
    echo "   $(docker system df 2>/dev/null | tail -n +2 | awk '{total+=$3} END {print total "B total reclaimed"}' || echo 'System cleaned')"
    echo ""
    echo "🔄 To restart the application later:"
    echo "   ./start.sh"
    echo ""
    
    # Optionally show system status
    read -p "Show final system status? (y/n): " show_status
    if [[ $show_status == "y" || $show_status == "yes" ]]; then
        show_final_status
    fi
    
    echo ""
    echo "🎯 Cleanup complete! Your system is now clean."
}

# Handle script interruption
trap 'echo ""; echo "❌ Cleanup interrupted. Some resources may still exist."; exit 1' INT TERM

# Run main function
main "$@"