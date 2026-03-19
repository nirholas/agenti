'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Store,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  MoreVertical,
  Trash2,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Package,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, type Storefront, type Facilitator, type Product } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface StorefrontsSectionProps {
  facilitatorId: string;
  facilitator: Facilitator;
}

export function StorefrontsSection({ facilitatorId, facilitator }: StorefrontsSectionProps) {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isManageProductsOpen, setIsManageProductsOpen] = useState(false);
  const [editingStorefront, setEditingStorefront] = useState<Storefront | null>(null);
  const [managingStorefront, setManagingStorefront] = useState<Storefront | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['storefronts', facilitatorId],
    queryFn: () => api.getStorefronts(facilitatorId),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', facilitatorId],
    queryFn: () => api.getProducts(facilitatorId),
  });

  const { data: storefrontDetail } = useQuery({
    queryKey: ['storefront', facilitatorId, managingStorefront?.id],
    queryFn: () => managingStorefront ? api.getStorefront(facilitatorId, managingStorefront.id) : null,
    enabled: !!managingStorefront,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createStorefront(facilitatorId, {
        name,
        slug,
        description: description || undefined,
        imageUrl: imageUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefronts', facilitatorId] });
      setIsCreateOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { storefrontId: string; updates: Parameters<typeof api.updateStorefront>[2] }) =>
      api.updateStorefront(facilitatorId, data.storefrontId, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefronts', facilitatorId] });
      setIsEditOpen(false);
      setEditingStorefront(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (storefrontId: string) => api.deleteStorefront(facilitatorId, storefrontId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefronts', facilitatorId] });
    },
  });

  const addProductMutation = useMutation({
    mutationFn: ({ storefrontId, productId }: { storefrontId: string; productId: string }) =>
      api.addProductToStorefront(facilitatorId, storefrontId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefront', facilitatorId, managingStorefront?.id] });
      queryClient.invalidateQueries({ queryKey: ['storefronts', facilitatorId] });
    },
  });

  const removeProductMutation = useMutation({
    mutationFn: ({ storefrontId, productId }: { storefrontId: string; productId: string }) =>
      api.removeProductFromStorefront(facilitatorId, storefrontId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefront', facilitatorId, managingStorefront?.id] });
      queryClient.invalidateQueries({ queryKey: ['storefronts', facilitatorId] });
    },
  });

  const resetForm = () => {
    setName('');
    setSlug('');
    setDescription('');
    setImageUrl('');
  };

  const copyUrl = (storefront: Storefront) => {
    navigator.clipboard.writeText(storefront.url);
    setCopiedId(storefront.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openEditDialog = (storefront: Storefront) => {
    setEditingStorefront(storefront);
    setName(storefront.name);
    setSlug(storefront.slug);
    setDescription(storefront.description || '');
    setImageUrl(storefront.imageUrl || '');
    setIsEditOpen(true);
  };

  const openManageProductsDialog = (storefront: Storefront) => {
    setManagingStorefront(storefront);
    setIsManageProductsOpen(true);
  };

  const handleUpdateStorefront = () => {
    if (!editingStorefront) return;
    updateMutation.mutate({
      storefrontId: editingStorefront.id,
      updates: {
        name,
        slug,
        description: description || null,
        imageUrl: imageUrl || null,
      },
    });
  };

  const toggleActive = (storefront: Storefront) => {
    updateMutation.mutate({
      storefrontId: storefront.id,
      updates: { active: !storefront.active },
    });
  };

  // Get products not in the current storefront
  const getAvailableProducts = () => {
    if (!productsData?.products || !storefrontDetail?.products) return [];
    const storefrontProductIds = new Set(storefrontDetail.products.map(p => p.id));
    return productsData.products.filter(p => !storefrontProductIds.has(p.id) && p.active);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            Storefronts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-4 h-4" />
              Storefronts
            </CardTitle>
            <CardDescription>
              Collections of products. Create a storefront to group products together for discovery by humans and agents.
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Create Storefront
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Storefront</DialogTitle>
                <DialogDescription>
                  Create a collection of products. Storefronts have both a human-readable page and a JSON API for agents.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., My Shop"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">URL Slug</Label>
                    <Input
                      id="slug"
                      placeholder="my-shop"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    />
                    <p className="text-xs text-muted-foreground">
                      /store/{slug || 'my-shop'}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="What does this storefront sell?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imageUrl">Image URL (optional)</Label>
                  <Input
                    id="imageUrl"
                    type="url"
                    placeholder="https://example.com/storefront-image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Banner or logo image for the storefront
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!name || !slug || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Storefront'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {!data?.storefronts?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Store className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No storefronts yet</p>
            <p className="text-sm">Create a storefront to group your products together</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.storefronts.map((storefront) => (
              <div
                key={storefront.id}
                className="border border-border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {storefront.imageUrl ? (
                      <img
                        src={storefront.imageUrl}
                        alt={storefront.name}
                        className="w-10 h-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                        <Store className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-medium">{storefront.name}</h3>
                      <p className="text-xs text-muted-foreground">/store/{storefront.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={storefront.active ? 'default' : 'secondary'}>
                      {storefront.active ? 'Active' : 'Inactive'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openManageProductsDialog(storefront)}>
                          <Package className="w-4 h-4 mr-2" />
                          Manage Products
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(storefront)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(storefront)}>
                          {storefront.active ? (
                            <>
                              <ToggleLeft className="w-4 h-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <ToggleRight className="w-4 h-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(storefront.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {storefront.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {storefront.description}
                  </p>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Package className="w-3 h-3" />
                  <span>{storefront.productCount ?? 0} products</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => copyUrl(storefront)}
                  >
                    {copiedId === storefront.id ? (
                      <>
                        <Check className="w-3 h-3 mr-1 text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy URL
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a href={storefront.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Open
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Storefront</DialogTitle>
            <DialogDescription>
              Update storefront details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-slug">URL Slug</Label>
                <Input
                  id="edit-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-imageUrl">Image URL</Label>
              <Input
                id="edit-imageUrl"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStorefront}
              disabled={!name || !slug || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Products Dialog */}
      <Dialog open={isManageProductsOpen} onOpenChange={(open) => {
        setIsManageProductsOpen(open);
        if (!open) setManagingStorefront(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Products</DialogTitle>
            <DialogDescription>
              Add or remove products from {managingStorefront?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current Products */}
            <div>
              <Label className="text-sm font-medium">Products in Storefront</Label>
              {storefrontDetail?.products?.length ? (
                <div className="mt-2 space-y-2">
                  {storefrontDetail.products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-8 h-8 rounded object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                            <Package className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.amount} {product.asset} on {product.network}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (managingStorefront) {
                            removeProductMutation.mutate({
                              storefrontId: managingStorefront.id,
                              productId: product.id,
                            });
                          }
                        }}
                        disabled={removeProductMutation.isPending}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No products in this storefront yet
                </p>
              )}
            </div>

            {/* Add Products */}
            <div>
              <Label className="text-sm font-medium">Add Product</Label>
              {getAvailableProducts().length ? (
                <div className="mt-2 space-y-2">
                  {getAvailableProducts().map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-8 h-8 rounded object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                            <Package className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.network}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (managingStorefront) {
                            addProductMutation.mutate({
                              storefrontId: managingStorefront.id,
                              productId: product.id,
                            });
                          }
                        }}
                        disabled={addProductMutation.isPending}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {productsData?.products?.length
                    ? 'All products are already in this storefront'
                    : 'Create some products first'}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsManageProductsOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
