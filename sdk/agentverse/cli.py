"""AgentVerse CLI — agentverse <command>"""

import json
import sys
import click
from .client import AgentVerseClient


def _client(host):
    return AgentVerseClient(host)


def _ok(data):
    click.echo(json.dumps(data, indent=2))


@click.group()
@click.option("--host", default="http://127.0.0.1:8000", envvar="AGENTVERSE_HOST",
              show_default=True, help="AgentVerse API base URL")
@click.pass_context
def cli(ctx, host):
    """AgentVerse CLI — publish and manage AI agents."""
    ctx.ensure_object(dict)
    ctx.obj["host"] = host


@cli.command()
@click.option("--name",     required=True,  help="Agent display name")
@click.option("--endpoint", required=True,  help="POST /run endpoint URL")
@click.option("--price",    required=True,  type=float, help="Price per request in USD")
@click.option("--category", default="default", show_default=True,
              type=click.Choice(["trading","analysis","data","risk","composite","default"]),
              help="Agent category")
@click.option("--description", default="", help="Short description")
@click.option("--wallet",   default=None, help="Owner wallet ID for earnings")
@click.option("--health",   default=None, help="Health check endpoint URL")
@click.pass_context
def register(ctx, name, endpoint, price, category, description, wallet, health):
    """Register a new agent on AgentVerse."""
    client = _client(ctx.obj["host"])
    try:
        result = client.register(
            name=name, endpoint=endpoint, price=price,
            category=category, description=description,
            wallet=wallet, health_endpoint=health,
        )
        click.secho(f"\n  Agent registered!", fg="green", bold=True)
        click.echo(f"  ID:       {result['id']}")
        click.echo(f"  Name:     {result['name']}")
        click.echo(f"  Endpoint: {result['endpoint']}")
        click.echo(f"  Price:    ${result['price_per_request']} / call")
        click.echo(f"  Category: {result['category']}")
        click.echo(f"  Status:   {result.get('status', 'active')}\n")
    except Exception as e:
        click.secho(f"  Error: {e}", fg="red")
        sys.exit(1)


@cli.command("list")
@click.pass_context
def list_agents(ctx):
    """List all registered agents."""
    client = _client(ctx.obj["host"])
    agents = client.list_agents()
    if not agents:
        click.echo("No agents registered yet.")
        return
    click.echo(f"\n  {'NAME':<22} {'CATEGORY':<12} {'PRICE':>8}  {'CALLS':>6}  {'EARNED':>8}")
    click.echo("  " + "─" * 62)
    for a in agents:
        click.echo(
            f"  {a['name']:<22} {a['category']:<12}"
            f"  ${a['price_per_request']:>6.4f}"
            f"  {a.get('requests', 0):>6}"
            f"  ${a.get('earnings', 0):>7.4f}"
        )
    click.echo()


@cli.command()
@click.argument("agent_id")
@click.option("--market", default="BTC", show_default=True)
@click.option("--wallet", default="demo", show_default=True)
@click.pass_context
def call(ctx, agent_id, market, wallet):
    """Call an agent and display the result."""
    client = _client(ctx.obj["host"])
    try:
        result = client.call(agent_id, {"market": market}, wallet=wallet)
        click.secho(f"\n  Result:", fg="cyan", bold=True)
        _ok(result)
    except Exception as e:
        click.secho(f"  Error: {e}", fg="red")
        sys.exit(1)


@cli.command()
@click.option("--wallet", default="demo", show_default=True)
@click.pass_context
def balance(ctx, wallet):
    """Check wallet balance."""
    client = _client(ctx.obj["host"])
    try:
        w = client.wallet(wallet)
        color = "red" if w["balance"] < 5 else "yellow" if w["balance"] < 20 else "green"
        click.secho(f"\n  Wallet: {wallet}", bold=True)
        click.secho(f"  Balance:  ${w['balance']:.4f}", fg=color)
        click.echo(f"  Spent:    ${w['total_spent']:.4f}")
        click.echo(f"  Earned:   ${w['total_earned']:.4f}\n")
    except Exception as e:
        click.secho(f"  Error: {e}", fg="red")
        sys.exit(1)


@cli.command()
@click.argument("agent_id")
@click.pass_context
def stats(ctx, agent_id):
    """Show metrics for an agent."""
    client = _client(ctx.obj["host"])
    try:
        m = client.metrics(agent_id)
        click.secho(f"\n  Metrics: {agent_id}", bold=True)
        click.echo(f"  Requests:    {m['requests']}")
        click.echo(f"  Avg latency: {m['avg_latency_ms']}ms")
        click.echo(f"  Errors:      {m['errors']}")
        click.echo(f"  Earnings:    ${m['earnings']:.4f}\n")
    except Exception as e:
        click.secho(f"  Error: {e}", fg="red")
        sys.exit(1)


def main():
    cli(obj={})


if __name__ == "__main__":
    main()
